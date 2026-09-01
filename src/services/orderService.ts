import { prisma } from '@/lib/prisma'

export async function getOrdersByMerchant(merchantId: string) {
  return prisma.order.findMany({
    where: { merchantId },
    include: {
      orderItems: {
        include: { product: true },
      },
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: {
        include: { product: true },
      },
      payments: true,
      merchant: true,
    },
  })
}

export async function getOrdersByStatus(status: string) {
  return prisma.order.findMany({
    where: { status: status as any }, // eslint-disable-line @typescript-eslint/no-explicit-any
    include: {
      orderItems: {
        include: { product: true },
      },
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}
