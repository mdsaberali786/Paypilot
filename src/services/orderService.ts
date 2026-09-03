import { prisma } from '@/lib/prisma'

export function merchantOwnsOrder(order: { merchantId: string }, merchantId: string) {
  return order.merchantId === merchantId
}

export function merchantOrderWhere(orderId: string, merchantId: string) {
  return { id: orderId, merchantId }
}

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

export async function getMerchantOrderById(id: string, merchantId: string) {
  return prisma.order.findFirst({
    where: merchantOrderWhere(id, merchantId),
    include: {
      orderItems: { include: { product: true } },
      payments: true,
      merchant: true,
    },
  })
}

export async function getPaymentsByMerchant(merchantId: string) {
  const orders = await getOrdersByMerchant(merchantId)
  return orders.flatMap((order) => order.payments.map((payment) => ({ order, payment })))
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
