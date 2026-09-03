import assert from 'node:assert/strict'
import test from 'node:test'
import { deterministicGrowthInsight, generateGrowthInsight, sanitizeGrowthInsight } from '../src/services/growthInsight'
import { canAccessMerchant } from '../src/services/sellerAuth'
import { canAccessPaymentOrder } from '../src/services/paymentService'
import { prisma } from '../src/lib/prisma'
import { resolveAuditMerchantId } from '../src/services/auditService'
import { getMerchantGrowthAnalytics, validateGrowthPeriod } from '../src/services/growthAnalytics'
import { tryAcquireInsightCooldown } from '../src/app/api/dashboard/growth/route'
import { Prisma } from '@prisma/client'

test('growth insights use deterministic recommendations when there are no orders', () => {
  const insight = deterministicGrowthInsight({
    revenue: 0,
    orders: 0,
    paidOrders: 0,
    conversionRate: 0,
    failedPayments: 0,
    productPerformance: [],
  })
  assert.match(insight, /No orders were recorded/)
})

test('growth insight sanitization removes secrets and personal data', () => {
  const safe = sanitizeGrowthInsight('Use api_key=do-not-share, token=abc123 and contact seller@example.com')
  assert.doesNotMatch(safe, /do-not-share/)
  assert.doesNotMatch(safe, /seller@example.com/)
  assert.match(safe, /\[redacted\]/)
})

test('growth analytics applies bounded periods and excludes activity outside the period', async () => {
  const originalOrderFindMany = prisma.order.findMany
  const originalAuditFindMany = prisma.auditLog.findMany
  const originalProductFindMany = prisma.product.findMany
  const now = new Date('2026-09-03T00:00:00.000Z')
  try {
    prisma.order.findMany = (async (args: Parameters<typeof prisma.order.findMany>[0]) => {
      assert.deepEqual(args!.where, { merchantId: 'merchant-a', createdAt: { gte: new Date('2026-08-27T00:00:00.000Z'), lte: now } })
      return [{
        merchantId: 'merchant-a',
        payments: [{ status: 'COMPLETED', amount: new Prisma.Decimal('100') }],
        orderItems: [],
      }]
    }) as unknown as typeof prisma.order.findMany
    prisma.auditLog.findMany = (async () => []) as unknown as typeof prisma.auditLog.findMany
    prisma.product.findMany = (async () => []) as unknown as typeof prisma.product.findMany
    const analytics = await getMerchantGrowthAnalytics('merchant-a', 7, now)
    assert.equal(analytics.orders, 1)
    assert.equal(analytics.periodDays, 7)
    assert.throws(() => validateGrowthPeriod(0), RangeError)
    assert.throws(() => validateGrowthPeriod(366), RangeError)
  } finally {
    prisma.order.findMany = originalOrderFindMany
    prisma.auditLog.findMany = originalAuditFindMany
    prisma.product.findMany = originalProductFindMany
  }
})

test('growth analytics includes only completed revenue and merchant-owned products', async () => {
  const originalOrderFindMany = prisma.order.findMany
  const originalAuditFindMany = prisma.auditLog.findMany
  const originalProductFindMany = prisma.product.findMany
  try {
    prisma.order.findMany = (async () => [
      {
        merchantId: 'merchant-a',
        payments: [
          { status: 'COMPLETED', amount: new Prisma.Decimal('100') },
          { status: 'PENDING', amount: new Prisma.Decimal('200') },
          { status: 'FAILED', amount: new Prisma.Decimal('300') },
        ],
        orderItems: [{
          productId: 'product-a',
          quantity: 2,
          unitPrice: new Prisma.Decimal('50'),
          product: { id: 'product-a', name: 'A', category: 'Test', inventory: 4 },
        }],
      },
    ]) as unknown as typeof prisma.order.findMany
    prisma.auditLog.findMany = (async () => [{
      action: 'AGENT_DECISION',
      reason: null,
      metadata: { event: 'add_to_cart', productId: 'product-a' },
    }]) as unknown as typeof prisma.auditLog.findMany
    prisma.product.findMany = (async (args: Parameters<typeof prisma.product.findMany>[0]) => {
      assert.deepEqual(args!.where, { merchantId: 'merchant-a' })
      return [{ id: 'product-a', name: 'A', category: 'Test', inventory: 4 }]
    }) as unknown as typeof prisma.product.findMany
    const analytics = await getMerchantGrowthAnalytics('merchant-a')
    assert.equal(analytics.revenue, 100)
    assert.equal(analytics.paidOrders, 1)
    assert.equal(analytics.failedPayments, 1)
    assert.equal(analytics.productPerformance[0].unitsSold, 2)
    assert.equal(analytics.productPerformance[0].addToCart, 1)
    assert.equal(analytics.productPerformance.some((product) => product.productId === 'product-b'), false)
  } finally {
    prisma.order.findMany = originalOrderFindMany
    prisma.auditLog.findMany = originalAuditFindMany
    prisma.product.findMany = originalProductFindMany
  }
})

test('empty and sparse growth data produce honest deterministic fallback text', () => {
  const insight = deterministicGrowthInsight({
    revenue: 0,
    orders: 2,
    paidOrders: 0,
    conversionRate: 0,
    failedPayments: 2,
    productPerformance: [],
  })
  assert.match(insight, /Not enough completed activity/)
  assert.doesNotMatch(insight, /₹\d+ from \d+ paid order/)
})

test('insight generation sanitizes aggregate input and falls back for malformed, oversized, or failed providers', async () => {
  const analytics = {
    merchantId: 'merchant-a',
    periodDays: 30,
    from: '2026-08-04T00:00:00.000Z',
    to: '2026-09-03T00:00:00.000Z',
    revenue: 100,
    totalRevenue: 100,
    orders: 2,
    totalOrders: 2,
    paidOrders: 1,
    conversionRate: 50,
    averageOrderValue: 100,
    failedPayments: 0,
    aiInteractions: 1,
    aiConversations: 1,
    searches: 1,
    recommendations: 1,
    addToCart: 1,
    cartReviews: 1,
    agentOrders: 1,
    productPerformance: [{ productId: 'product-a', name: 'Safe product', category: 'Test', unitsSold: 1, revenue: 100, orders: 1, ordersContainingProduct: 1, inventory: 2, recommendedCount: 1, recommendations: 1, addToCartCount: 1, addToCart: 1 }],
  }
  let captured = ''
  const client = { interactions: { create: async (request: Record<string, unknown>) => { captured = String(request.input); return { output_text: 'Use the safe product.' } } } }
  const result = await generateGrowthInsight(analytics, client)
  assert.equal(result.source, 'gemini')
  assert.match(captured, /merchant metrics/)
  assert.doesNotMatch(captured, /merchantId|buyer|email|password|token|secret/)
  const malformed = await generateGrowthInsight(analytics, { interactions: { create: async () => ({ output_text: '' }) } })
  assert.equal(malformed.source, 'fallback')
  const oversized = await generateGrowthInsight(analytics, { interactions: { create: async () => ({ output_text: 'x'.repeat(2_001) }) } })
  assert.equal(oversized.source, 'fallback')
  const failed = await generateGrowthInsight(analytics, { interactions: { create: async () => { throw new Error('provider down') } } })
  assert.equal(failed.source, 'fallback')
})

test('growth data access remains scoped to the authenticated seller', () => {
  assert.equal(canAccessMerchant('merchant-a', 'merchant-a'), true)
  assert.equal(canAccessMerchant('merchant-a', 'merchant-b'), false)
  assert.equal(canAccessMerchant('merchant-a', null), false)
})

test('payment verification and retry require ownership of the buyer order', () => {
  assert.equal(canAccessPaymentOrder('buyer-a', 'buyer-a'), true)
  assert.equal(canAccessPaymentOrder('buyer-a', 'buyer-b'), false)
  assert.equal(canAccessPaymentOrder(null, 'buyer-a'), false)
})

test('agent audit attribution always prefers actual product ownership over context', async () => {
  const originalFindUnique = prisma.product.findUnique
  try {
    prisma.product.findUnique = (async (args: Parameters<typeof prisma.product.findUnique>[0]) => args.where?.id === 'product-b' ? { merchantId: 'merchant-b' } : null) as unknown as typeof prisma.product.findUnique
    assert.equal(await resolveAuditMerchantId({ productIds: ['product-b'], merchantId: 'merchant-a' }), 'merchant-b')
    assert.equal(await resolveAuditMerchantId({ productIds: ['unknown'], merchantId: 'merchant-a' }), undefined)
  } finally {
    prisma.product.findUnique = originalFindUnique
  }
})

test('order attribution always prefers actual order ownership over context', async () => {
  const originalFindUnique = prisma.order.findUnique
  try {
    prisma.order.findUnique = (async () => ({ merchantId: 'merchant-b' })) as unknown as typeof prisma.order.findUnique
    assert.equal(await resolveAuditMerchantId({ orderId: 'order-b', merchantId: 'merchant-a' }), 'merchant-b')
  } finally {
    prisma.order.findUnique = originalFindUnique
  }
})

test('search attribution is safe for one merchant, multiple merchants, and unknown products', async () => {
  const originalFindUnique = prisma.product.findUnique
  const originalFindMany = prisma.product.findMany
  try {
    prisma.product.findUnique = (async (args: Parameters<typeof prisma.product.findUnique>[0]) => args.where?.id === 'product-a' ? { merchantId: 'merchant-a' } : null) as unknown as typeof prisma.product.findUnique
    prisma.product.findMany = (async (args: Parameters<typeof prisma.product.findMany>[0]) => {
      const ids = (args!.where as { id: { in: string[] } }).id.in
      return ids.includes('product-a') && ids.includes('product-b')
        ? [{ merchantId: 'merchant-a' }, { merchantId: 'merchant-b' }]
        : ids.includes('product-a') ? [{ merchantId: 'merchant-a' }] : []
    }) as unknown as typeof prisma.product.findMany
    assert.equal(await resolveAuditMerchantId({ productIds: ['product-a', 'product-b'], merchantId: 'merchant-a' }), undefined)
    assert.equal(await resolveAuditMerchantId({ productIds: ['product-a'], merchantId: 'merchant-b' }), 'merchant-a')
    assert.equal(await resolveAuditMerchantId({ productIds: ['unknown'], merchantId: 'merchant-a' }), undefined)
  } finally {
    prisma.product.findUnique = originalFindUnique
    prisma.product.findMany = originalFindMany
  }
})

test('insight cooldown is per seller and concurrent acquisition is not duplicated', () => {
  const seller = `cooldown-${Date.now()}`
  assert.equal(tryAcquireInsightCooldown(seller, 1_000_000), true)
  assert.equal(tryAcquireInsightCooldown(seller, 1_000_001), false)
  assert.equal(tryAcquireInsightCooldown(`${seller}-other`, 1_000_001), true)
  assert.equal(tryAcquireInsightCooldown(seller, 1_015_000), true)
})
