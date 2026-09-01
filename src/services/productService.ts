import { prisma } from '@/lib/prisma'

export async function getActiveProducts() {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { merchant: true },
  })
}

export async function getProductsByCategory(category: string) {
  return prisma.product.findMany({
    where: { category, active: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getMerchantProducts(merchantId: string) {
  return prisma.product.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' },
  })
}
