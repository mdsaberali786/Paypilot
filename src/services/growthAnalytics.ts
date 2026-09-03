import { prisma } from '@/lib/prisma'

export type GrowthAnalytics = {
  merchantId: string
  periodDays: number
  from: string
  to: string
  revenue: number
  totalRevenue: number
  orders: number
  totalOrders: number
  paidOrders: number
  conversionRate: number
  averageOrderValue: number
  failedPayments: number
  aiInteractions: number
  aiConversations: number
  searches: number
  recommendations: number
  addToCart: number
  cartReviews: number
  agentOrders: number
  productPerformance: ProductPerformance[]
}

export type ProductPerformance = {
  productId: string
  name: string
  category: string
  unitsSold: number
  revenue: number
  orders: number
  ordersContainingProduct: number
  inventory: number
  recommendedCount: number
  recommendations: number
  addToCartCount: number
  addToCart: number
}

function periodStart(periodDays: number, now: Date) {
  const start = new Date(now)
  start.setDate(start.getDate() - periodDays)
  return start
}

export function validateGrowthPeriod(periodDays: number) {
  if (!Number.isInteger(periodDays) || periodDays <= 0 || periodDays > 365) {
    throw new RangeError('Growth period must be between 1 and 365 days.')
  }
  return periodDays
}

export async function getProductPerformance(merchantId: string, periodDays = 30, now = new Date()) {
  const start = periodStart(validateGrowthPeriod(periodDays), now)
  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      where: { merchantId, createdAt: { gte: start, lte: now } },
      include: {
        payments: { where: { provider: 'razorpay', status: 'COMPLETED' }, select: { id: true, status: true } },
        orderItems: { include: { product: { select: { id: true, name: true, category: true, inventory: true } } } },
      },
    }),
    prisma.product.findMany({ where: { merchantId }, select: { id: true, name: true, category: true, inventory: true }, take: 1_000 }),
  ])
  return buildProductPerformance(orders, products)
}

function buildProductPerformance(orders: Array<{
  payments: Array<{ id?: string; status?: string }>
  orderItems: Array<{ productId: string; quantity: number; unitPrice: unknown; product: { id: string; name: string; category: string; inventory: number } }>
}>, catalog: Array<{ id: string; name: string; category: string; inventory: number }> = []) {
  const performance = new Map<string, ProductPerformance>(catalog.map((product) => [product.id, {
    productId: product.id,
    name: product.name,
    category: product.category,
    unitsSold: 0,
    revenue: 0,
    orders: 0,
    ordersContainingProduct: 0,
    inventory: product.inventory,
    recommendedCount: 0,
    recommendations: 0,
    addToCartCount: 0,
    addToCart: 0,
  }]))
  for (const order of orders) {
    if (!order.payments.some((payment) => payment.status === 'COMPLETED')) continue
    for (const item of order.orderItems) {
      const current = performance.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        category: item.product.category,
        unitsSold: 0,
        revenue: 0,
        orders: 0,
        ordersContainingProduct: 0,
        inventory: item.product.inventory,
        recommendedCount: 0,
        recommendations: 0,
        addToCartCount: 0,
        addToCart: 0,
      }
      current.unitsSold += item.quantity
      current.revenue += Number(item.unitPrice) * item.quantity
      current.orders += 1
      current.ordersContainingProduct = current.orders
      performance.set(item.productId, current)
    }
  }
  return [...performance.values()].sort((a, b) => b.revenue - a.revenue)
}

export async function getMerchantGrowthAnalytics(merchantId: string, periodDays = 30, now = new Date()): Promise<GrowthAnalytics> {
  const safePeriodDays = validateGrowthPeriod(periodDays)
  const start = periodStart(safePeriodDays, now)
  const [orders, auditEvents, products] = await Promise.all([
    prisma.order.findMany({
      where: { merchantId, createdAt: { gte: start, lte: now } },
      include: {
        payments: { where: { provider: 'razorpay' }, select: { status: true, amount: true } },
        orderItems: { include: { product: { select: { id: true, name: true, category: true, inventory: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { merchantId, createdAt: { gte: start, lte: now } },
      select: { action: true, reason: true, metadata: true },
      take: 10_000,
    }),
    prisma.product.findMany({ where: { merchantId }, select: { id: true, name: true, category: true, inventory: true }, take: 1_000 }),
  ])
  const activity = auditEvents as Array<{ action: string; reason: string | null; metadata: unknown }>
  const eventName = (event: { action: string; reason: string | null; metadata: unknown }) => {
    const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as { event?: unknown } : {}
    return typeof metadata.event === 'string' ? metadata.event : (event.reason ?? '').toLowerCase()
  }
  const countEvent = (name: string) => auditEvents.filter((event) => eventName(event) === name || eventName(event).includes(name)).length
  const paidOrders = orders.filter((order) => order.payments.some((payment) => payment.status === 'COMPLETED'))
  const productPerformance = buildProductPerformance(orders, products)
  for (const event of activity) {
    const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as { event?: unknown; productId?: unknown; productIds?: unknown } : {}
    const eventName = typeof metadata.event === 'string'
      ? metadata.event
      : event.action === 'PRODUCT_RECOMMENDED'
        ? 'recommendation'
        : ''
    const productIds = [
      ...(typeof metadata.productId === 'string' ? [metadata.productId] : []),
      ...(Array.isArray(metadata.productIds) ? metadata.productIds.filter((id): id is string => typeof id === 'string') : []),
    ]
    for (const productId of productIds) {
      const product = productPerformance.find((candidate) => candidate.productId === productId)
      if (!product) continue
      if (eventName === 'recommendation') {
        product.recommendedCount += 1
        product.recommendations += 1
      }
      if (eventName === 'add_to_cart') {
        product.addToCartCount += 1
        product.addToCart += 1
      }
    }
  }
  const revenue = paidOrders.reduce((sum, order) => {
    const payment = order.payments.find((candidate) => candidate.status === 'COMPLETED')
    return sum + Number(payment?.amount ?? order.totalAmount)
  }, 0)
  const failedPayments = orders.filter((order) => order.payments.some((payment) => payment.status === 'FAILED')).length
  const conversionRate = orders.length === 0 ? 0 : Number(((paidOrders.length / orders.length) * 100).toFixed(2))
  return {
    merchantId,
    periodDays: safePeriodDays,
    from: start.toISOString(),
    to: now.toISOString(),
    revenue,
    totalRevenue: revenue,
    orders: orders.length,
    totalOrders: orders.length,
    paidOrders: paidOrders.length,
    conversionRate,
    averageOrderValue: paidOrders.length === 0 ? 0 : Number((revenue / paidOrders.length).toFixed(2)),
    failedPayments,
    aiInteractions: activity.filter((event) => event.action === 'AGENT_DECISION').length,
    aiConversations: countEvent('conversation'),
    searches: countEvent('search'),
    recommendations: activity.filter((event) => event.action === 'PRODUCT_RECOMMENDED' || eventName(event) === 'recommendation').length,
    addToCart: countEvent('add_to_cart'),
    cartReviews: countEvent('cart_review'),
    agentOrders: countEvent('order_created'),
    productPerformance,
  }
}

export const getGrowthAnalytics = getMerchantGrowthAnalytics
