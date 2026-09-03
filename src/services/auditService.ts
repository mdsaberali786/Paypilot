import { prisma } from '@/lib/prisma'

export function merchantAuditWhere(merchantId: string) {
  return { merchantId }
}

export function merchantOwnsAuditLog(log: { merchantId: string }, merchantId: string) {
  return log.merchantId === merchantId
}

export async function resolveAuditMerchantId(input: {
  merchantId?: string
  orderId?: string
  productIds?: string[]
}) {
  const hasCommerceObject = Boolean(input.orderId || input.productIds?.some(Boolean))
  try {
    if (input.orderId) {
      const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { merchantId: true } })
      if (order) return order.merchantId
      return undefined
    }

    const productIds = [...new Set((input.productIds ?? []).filter(Boolean))]
    if (productIds.length > 0) {
      const singleProduct = productIds.length === 1
        ? await prisma.product.findUnique({ where: { id: productIds[0] }, select: { merchantId: true } })
        : null
      const products = singleProduct
        ? [singleProduct]
        : productIds.length > 1
          ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { merchantId: true } })
          : []
      const merchantIds = [...new Set(products.map((product) => product.merchantId))]
      if (merchantIds.length === 1) return merchantIds[0]
      return undefined
    }
  } catch {
    // Auditing must never make the customer-facing agent fail.
    if (hasCommerceObject) return undefined
  }

  return input.merchantId
}

export async function getAuditLogsByMerchant(merchantId: string) {
  return prisma.auditLog.findMany({
    where: merchantAuditWhere(merchantId),
    include: {
      order: {
        include: {
          orderItems: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function getAiActivityByMerchant(merchantId: string) {
  return prisma.auditLog.findMany({
    where: merchantAuditWhere(merchantId),
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, action: true, reason: true, metadata: true, orderId: true, createdAt: true },
  })
}

export async function getAuditLogsByAction(action: string) {
  return prisma.auditLog.findMany({
    where: { action: action as any }, // eslint-disable-line @typescript-eslint/no-explicit-any
    include: {
      order: true,
      merchant: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function getAuditLogsByOrder(orderId: string) {
  return prisma.auditLog.findMany({
    where: { orderId },
    include: {
      merchant: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}
