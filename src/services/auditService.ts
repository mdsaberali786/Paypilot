import { prisma } from '@/lib/prisma'

export async function getAuditLogsByMerchant(merchantId: string) {
  return prisma.auditLog.findMany({
    where: { merchantId },
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
