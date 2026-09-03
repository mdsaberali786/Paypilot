import { prisma } from '@/lib/prisma'

export function merchantAuditWhere(merchantId: string) {
  return { merchantId }
}

export function merchantOwnsAuditLog(log: { merchantId: string }, merchantId: string) {
  return log.merchantId === merchantId
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
