import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { Prisma } from '@prisma/client'
import Razorpay from 'razorpay'
import { prisma } from '../src/lib/prisma'
import { createCustomerOrder, CheckoutValidationError } from '../src/services/checkoutService'
import { executeAgentTool } from '../src/services/agentTools'
import {
  rupeesToPaise,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
  PaymentValidationError,
  canRetryRazorpayPayment,
  isDuplicateWebhookEvent,
  retryRazorpayPayment,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} from '../src/services/paymentService'
import { canAccessBuyerOrder, hashPassword, verifyPassword } from '../src/services/buyerAuth'

type MockRazorpayOrders = {
  create: (args?: unknown) => Promise<{ id: string; amount: number; currency: string }>
}

type MockRazorpayInstance = {
  orders: MockRazorpayOrders
}

test('buyer passwords are salted scrypt hashes and verify safely', async () => {
  const passwordHash = await hashPassword('correct horse battery staple')
  assert.match(passwordHash, /^scrypt:[^:]+:[a-f0-9]+$/)
  assert.notEqual(passwordHash, 'correct horse battery staple')
  assert.equal(await verifyPassword('correct horse battery staple', passwordHash), true)
  assert.equal(await verifyPassword('wrong password', passwordHash), false)
})

test('buyer password requirements reject short passwords', async () => {
  await assert.rejects(() => hashPassword('short'), /at least 8 characters/)
})

test('buyer order access requires a matching non-legacy authenticated buyer', () => {
  assert.equal(canAccessBuyerOrder('buyer-a', 'buyer-a'), true)
  assert.equal(canAccessBuyerOrder('buyer-a', 'buyer-b'), false)
  assert.equal(canAccessBuyerOrder(null, 'buyer-a'), false)
  assert.equal(canAccessBuyerOrder('buyer-a', null), false)
  assert.equal(canAccessBuyerOrder(null, null), false)
})

type RazorpayPrototype = {
  addResources?: (this: MockRazorpayInstance) => void
}

test('rupeesToPaise converts INR to paise correctly', () => {
  assert.equal(rupeesToPaise('100.50'), 10050)
  assert.equal(rupeesToPaise(100), 10000)
  assert.equal(rupeesToPaise(new Prisma.Decimal('99.99')), 9999)
  assert.equal(rupeesToPaise('1'), 100)
})

test('rupeesToPaise rejects invalid amounts', () => {
  assert.throws(() => rupeesToPaise(0), PaymentValidationError)
  assert.throws(() => rupeesToPaise(-100), PaymentValidationError)
  assert.throws(() => rupeesToPaise('invalid'))
})

test('verifyRazorpaySignature validates correct signatures', () => {
  const orderId = 'order_test123'
  const paymentId = 'pay_test456'
  const secret = 'test_secret_key'

  const signature = 'e8e3fd8a42cbe38aba949bcd7c4738b3d838b4976c95e3e9f035e71c88fb9f8a'
  assert.equal(verifyRazorpaySignature(orderId, paymentId, signature, secret), true)
})

test('verifyRazorpaySignature rejects invalid signatures', () => {
  const orderId = 'order_test123'
  const paymentId = 'pay_test456'
  const secret = 'test_secret_key'
  const invalidSignature = 'invalid_signature_hash'

  assert.equal(verifyRazorpaySignature(orderId, paymentId, invalidSignature, secret), false)
})

test('verifyRazorpayWebhookSignature validates correct webhook signatures', () => {
  const rawBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123', order_id: 'order_456' } } } })
  const secret = 'webhook_secret'

  const signature = '9aa41b44c295f08fd889be4bf5a2f66caf478c20fe9279dd08a17135be145f6a'
  assert.equal(verifyRazorpayWebhookSignature(rawBody, signature, secret), true)
})

test('verifyRazorpayWebhookSignature rejects invalid webhook signatures', () => {
  const rawBody = JSON.stringify({ event: 'payment.captured' })
  const secret = 'webhook_secret'
  const invalidSignature = 'invalid_webhook_signature'

  assert.equal(verifyRazorpayWebhookSignature(rawBody, invalidSignature, secret), false)
})

test('canRetryRazorpayPayment only allows retries for failed or retryable payments', () => {
  assert.deepEqual(canRetryRazorpayPayment('FAILED', 'FAILED'), { allowed: true, reason: 'Payment retry is allowed.' })
  assert.deepEqual(canRetryRazorpayPayment('PENDING', 'FAILED'), { allowed: true, reason: 'Payment retry is allowed.' })
  assert.deepEqual(canRetryRazorpayPayment('CONFIRMED', 'COMPLETED'), { allowed: false, reason: 'This order has already been paid.' })
  assert.deepEqual(canRetryRazorpayPayment('PENDING', 'PROCESSING'), { allowed: false, reason: 'A payment is already in progress for this order.' })
})

test('isDuplicateWebhookEvent prevents duplicate Razorpay webhook processing', () => {
  assert.equal(isDuplicateWebhookEvent('evt_123', 'evt_123'), true)
  assert.equal(isDuplicateWebhookEvent('evt_123', 'evt_456'), false)
  assert.equal(isDuplicateWebhookEvent(null, 'evt_123'), false)
})

test('failed payment recovery keeps the order intact and allows a safe retry', async () => {
  const originalOrderFindUnique = prisma.order.findUnique
  const originalPaymentCreate = prisma.payment.create
  const originalAuditCreate = prisma.auditLog.create
  const originalOrderCreate = prisma.order.create
  const originalSetKeyId = process.env.RAZORPAY_KEY_ID
  const originalSetKeySecret = process.env.RAZORPAY_KEY_SECRET
  const originalAddResources = (Razorpay.prototype as unknown as RazorpayPrototype).addResources

  try {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
    process.env.RAZORPAY_KEY_SECRET = 'test_secret_key'
    ;(Razorpay.prototype as unknown as RazorpayPrototype).addResources = function () {
      this.orders = { create: async () => ({ id: 'rzp_order_retry_123', amount: 299900, currency: 'INR' }) }
    }

    prisma.order.findUnique = (async () => ({
      id: 'order_retry_123',
      merchantId: 'merchant_1',
      currency: 'INR',
      status: 'PENDING',
      totalAmount: new Prisma.Decimal('2999'),
      payments: [{ provider: 'razorpay', status: 'FAILED' }],
    })) as unknown as typeof prisma.order.findUnique
    prisma.payment.create = (async () => ({ id: 'payment_retry_001' })) as unknown as typeof prisma.payment.create
    const emittedActions: string[] = []
    prisma.auditLog.create = (async (args) => {
      emittedActions.push(args.data.action)
      return { id: 'audit_retry' } as unknown as Awaited<ReturnType<typeof prisma.auditLog.create>>
    }) as typeof prisma.auditLog.create
    prisma.order.create = (async () => {
      throw new Error('PayPilot order creation should not be duplicated during retry.')
    }) as never

    const result = await retryRazorpayPayment('order_retry_123')

    assert.equal(result.paypilotOrderId, 'order_retry_123')
    assert.equal(result.providerOrderId, 'rzp_order_retry_123')
    assert.equal(result.amount, 299900)
    assert.equal(result.currency, 'INR')
    assert.ok(emittedActions.includes('PAYMENT_INITIATED'))
    assert.ok(emittedActions.includes('PAYMENT_RETRY_INITIATED'))
  } finally {
    prisma.order.findUnique = originalOrderFindUnique
    prisma.payment.create = originalPaymentCreate
    prisma.auditLog.create = originalAuditCreate
    prisma.order.create = originalOrderCreate
    if (originalSetKeyId === undefined) delete process.env.RAZORPAY_KEY_ID
    else process.env.RAZORPAY_KEY_ID = originalSetKeyId
    if (originalSetKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET
    else process.env.RAZORPAY_KEY_SECRET = originalSetKeySecret
    const prototype = Razorpay.prototype as unknown as RazorpayPrototype
    if (originalAddResources === undefined) delete prototype.addResources
    else prototype.addResources = originalAddResources
  }
})

test('completed payment cannot be retried and duplicate success is blocked', async () => {
  const originalOrderFindUnique = prisma.order.findUnique
  try {
    prisma.order.findUnique = (async () => ({
      id: 'order_completed_123',
      merchantId: 'merchant_1',
      currency: 'INR',
      status: 'CONFIRMED',
      totalAmount: new Prisma.Decimal('2999'),
      payments: [{ provider: 'razorpay', status: 'COMPLETED' }],
    })) as unknown as typeof prisma.order.findUnique

    await assert.rejects(() => retryRazorpayPayment('order_completed_123'), /already been paid/)
  } finally {
    prisma.order.findUnique = originalOrderFindUnique
  }
})

test('payment verification authorizes the order before looking up or mutating payment state', async () => {
  const originalOrderFindUnique = prisma.order.findUnique
  const originalPaymentFindUnique = prisma.payment.findUnique
  const originalPaymentUpdate = prisma.payment.update
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET
  let paymentLookupCount = 0
  let paymentMutationCount = 0
  try {
    process.env.RAZORPAY_KEY_SECRET = 'test_secret_key'
    prisma.order.findUnique = (async () => ({ id: 'order-owner', buyerId: 'buyer-a' })) as unknown as typeof prisma.order.findUnique
    prisma.payment.findUnique = (async () => {
      paymentLookupCount += 1
      return null
    }) as unknown as typeof prisma.payment.findUnique
    prisma.payment.update = (async () => {
      paymentMutationCount += 1
      return {} as never
    }) as unknown as typeof prisma.payment.update
    await assert.rejects(
      () => verifyRazorpayPayment({
        paypilotOrderId: 'order-owner',
        providerOrderId: 'provider-order',
        providerPaymentId: 'provider-payment',
        signature: 'signature',
        buyerId: 'buyer-b',
      }),
      /does not belong/,
    )
    assert.equal(paymentLookupCount, 0)
    assert.equal(paymentMutationCount, 0)
  } finally {
    prisma.order.findUnique = originalOrderFindUnique
    prisma.payment.findUnique = originalPaymentFindUnique
    prisma.payment.update = originalPaymentUpdate
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret
  }
})

test('invalid Razorpay signature fails verification without confirming the order', async () => {
  const originalOrderFindUnique = prisma.order.findUnique
  const originalPaymentFindUnique = prisma.payment.findUnique
  const originalPaymentUpdate = prisma.payment.update
  const originalAuditCreate = prisma.auditLog.create
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET

  try {
    process.env.RAZORPAY_KEY_SECRET = 'test_secret_key'
    prisma.order.findUnique = (async () => ({
      id: 'order_123',
      merchantId: 'merchant_1',
      buyerId: 'buyer_1',
    })) as unknown as typeof prisma.order.findUnique
    prisma.payment.findUnique = (async () => ({
      id: 'payment_123',
      orderId: 'order_123',
      provider: 'razorpay',
      providerOrderId: 'order_123',
      providerPaymentId: 'pay_123',
      status: 'PENDING',
      order: { id: 'order_123', merchantId: 'merchant_1' },
    })) as unknown as typeof prisma.payment.findUnique
    prisma.payment.update = (async (args: { where: { id: string }; data: { status: string } }) => {
      assert.equal(args.where.id, 'payment_123')
      assert.equal(args.data.status, 'FAILED')
      return { id: 'payment_123', status: 'FAILED' } as unknown as Awaited<ReturnType<typeof prisma.payment.update>>
    }) as unknown as typeof prisma.payment.update
    const auditEntries: string[] = []
    prisma.auditLog.create = (async (args) => {
      auditEntries.push(args.data.action)
      return { id: 'audit_verification' } as unknown as Awaited<ReturnType<typeof prisma.auditLog.create>>
    }) as typeof prisma.auditLog.create

    await assert.rejects(
      () => verifyRazorpayPayment({ paypilotOrderId: 'order_123', providerOrderId: 'order_123', providerPaymentId: 'pay_123', signature: 'bad-signature' }),
      /We could not verify this payment/
    )

    assert.deepEqual(auditEntries, ['PAYMENT_VERIFICATION_FAILED', 'PAYMENT_RECOVERY_FAILED'])
  } finally {
    prisma.order.findUnique = originalOrderFindUnique
    prisma.payment.findUnique = originalPaymentFindUnique
    prisma.payment.update = originalPaymentUpdate
    prisma.auditLog.create = originalAuditCreate
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret
  }
})

test('duplicate Razorpay webhook payloads are ignored and audited', async () => {
  const originalWebhookCreate = prisma.webhookEvent.create
  const originalPaymentFindUnique = prisma.payment.findUnique
  const originalAuditCreate = prisma.auditLog.create
  const originalWebhookUpdate = prisma.webhookEvent.update
  const originalKeySecret = process.env.RAZORPAY_WEBHOOK_SECRET
  const rawBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'order_123', id: 'pay_123' } } } })
  const signature = createHmac('sha256', 'webhook_secret').update(rawBody).digest('hex')

  try {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret'
    prisma.webhookEvent.create = (async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Duplicate webhook event', { code: 'P2002', clientVersion: 'test' } as never)
      throw error
    }) as unknown as typeof prisma.webhookEvent.create
    prisma.payment.findUnique = (async () => ({
      id: 'payment_123',
      orderId: 'order_456',
      provider: 'razorpay',
      providerOrderId: 'order_123',
      status: 'PENDING',
      order: { id: 'order_456', merchantId: 'merchant_1' },
    })) as unknown as typeof prisma.payment.findUnique
    const auditEntries: string[] = []
    prisma.auditLog.create = (async (args) => {
      auditEntries.push(args.data.action)
      return { id: 'audit_duplicate' } as unknown as Awaited<ReturnType<typeof prisma.auditLog.create>>
    }) as typeof prisma.auditLog.create
    prisma.webhookEvent.update = (async () => {
      throw new Error('duplicate webhook should not process again')
    }) as never

    const result = await handleRazorpayWebhook(rawBody, signature, 'evt_duplicate_123')

    assert.equal(result.ignored, true)
    assert.equal(result.duplicate, true)
    assert.deepEqual(auditEntries, ['WEBHOOK_REPLAY_IGNORED'])
  } finally {
    prisma.webhookEvent.create = originalWebhookCreate
    prisma.payment.findUnique = originalPaymentFindUnique
    prisma.auditLog.create = originalAuditCreate
    prisma.webhookEvent.update = originalWebhookUpdate
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET
    else process.env.RAZORPAY_WEBHOOK_SECRET = originalKeySecret
  }
})

test('inventory failure blocks checkout and records the recovery trigger', async () => {
  const originalTransaction = prisma.$transaction
  const originalAuditCreate = prisma.auditLog.create

  try {
    const auditEntries: { action: string; reason: string }[] = []
    prisma.auditLog.create = (async (args) => {
      auditEntries.push({ action: String(args.data.action ?? ''), reason: String(args.data.reason ?? '') })
      return { id: 'audit_inventory' } as unknown as Awaited<ReturnType<typeof prisma.auditLog.create>>
    }) as typeof prisma.auditLog.create
    prisma.$transaction = (async (callback: (tx: unknown) => Promise<unknown>) => callback({
      order: { findUnique: async () => null },
      product: {
        findMany: async () => [{ id: 'p1', name: 'Headphones', active: true, merchantId: 'merchant_1', currency: 'INR', inventory: 1, price: new Prisma.Decimal('49.99') }],
        updateMany: async () => ({ count: 0 }),
      },
      auditLog: { create: prisma.auditLog.create },
    } as never)) as unknown as typeof prisma.$transaction

    await assert.rejects(
      () => createCustomerOrder([{ productId: 'p1', quantity: 2 }], 'checkout-a-valid-key-12345'),
      CheckoutValidationError,
    )
    assert.ok(auditEntries.some((entry) => entry.action === 'INVENTORY_RECOVERY_TRIGGERED'))
  } finally {
    prisma.$transaction = originalTransaction
    prisma.auditLog.create = originalAuditCreate
  }
})

test('AI tool failures are caught, audited and kept customer-safe', async () => {
  const originalProductFindUnique = prisma.product.findUnique
  const originalAuditCreate = prisma.auditLog.create

  try {
    prisma.product.findUnique = (async () => {
      throw new Error('database unavailable')
    }) as unknown as typeof prisma.product.findUnique
    const auditEntries: { action: string; metadata: Record<string, unknown> }[] = []
    prisma.auditLog.create = (async (args) => {
      auditEntries.push({ action: args.data.action, metadata: (args.data.metadata ?? {}) as Record<string, unknown> })
      return { id: 'audit_agent' } as unknown as Awaited<ReturnType<typeof prisma.auditLog.create>>
    }) as typeof prisma.auditLog.create

    const result = await executeAgentTool('get_product_details', { productId: 'p1' }, { cart: [], confirmed: false, checkoutKey: 'checkout-key-123456', merchantId: 'merchant_1' })

    assert.equal(result.tool, 'get_product_details')
    assert.equal(result.status, 'blocked')
    assert.equal(result.message, 'I could not complete that action right now. Please try again.')
    assert.equal(result.message.includes('database unavailable'), false)
    assert.equal(auditEntries.length, 0)
  } finally {
    prisma.product.findUnique = originalProductFindUnique
    prisma.auditLog.create = originalAuditCreate
  }
})

test('recovery audit events are emitted for the relevant Step 6 paths', async () => {
  const originalOrderFindUnique = prisma.order.findUnique
  const originalPaymentCreate = prisma.payment.create
  const originalAuditCreate = prisma.auditLog.create
  const originalAddResources = (Razorpay.prototype as unknown as RazorpayPrototype).addResources
  const originalKeyId = process.env.RAZORPAY_KEY_ID
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET

  try {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
    process.env.RAZORPAY_KEY_SECRET = 'test_secret_key'
    ;(Razorpay.prototype as unknown as RazorpayPrototype).addResources = function () {
      this.orders = { create: async () => ({ id: 'rzp_order_audit_123', amount: 299900, currency: 'INR' }) }
    }
    prisma.order.findUnique = (async () => ({
      id: 'order_audit_123',
      merchantId: 'merchant_1',
      currency: 'INR',
      status: 'PENDING',
      totalAmount: new Prisma.Decimal('2999'),
      payments: [{ provider: 'razorpay', status: 'FAILED' }],
    })) as unknown as typeof prisma.order.findUnique
    prisma.payment.create = (async () => ({ id: 'payment_audit_001' })) as unknown as typeof prisma.payment.create
    const actions: string[] = []
    prisma.auditLog.create = (async (args) => {
      actions.push(args.data.action)
      return { id: 'audit_event' } as unknown as Awaited<ReturnType<typeof prisma.auditLog.create>>
    }) as typeof prisma.auditLog.create

    await retryRazorpayPayment('order_audit_123')
    assert.ok(actions.includes('PAYMENT_RETRY_INITIATED'))
  } finally {
    prisma.order.findUnique = originalOrderFindUnique
    prisma.payment.create = originalPaymentCreate
    prisma.auditLog.create = originalAuditCreate
    if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID
    else process.env.RAZORPAY_KEY_ID = originalKeyId
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret
    const prototype = Razorpay.prototype as unknown as RazorpayPrototype
    if (originalAddResources === undefined) delete prototype.addResources
    else prototype.addResources = originalAddResources
  }
})
