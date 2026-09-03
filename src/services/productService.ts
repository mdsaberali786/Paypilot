import { prisma } from '@/lib/prisma'

export function merchantOwnsProduct(product: { merchantId: string }, merchantId: string) {
  return product.merchantId === merchantId
}

export function merchantProductWhere(productId: string, merchantId: string) {
  return { id: productId, merchantId }
}

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

export async function getMerchantProductById(productId: string, merchantId: string) {
  return prisma.product.findFirst({
    where: merchantProductWhere(productId, merchantId),
    include: { merchant: true },
  })
}

export async function createProduct(input: {
  merchantId: string
  name: string
  description: string
  category: string
  price: number
  inventory: number
  imageUrl?: string | null
}) {
  return prisma.product.create({
    data: {
      merchantId: input.merchantId,
      name: input.name,
      description: input.description,
      category: input.category,
      price: input.price,
      inventory: input.inventory,
      imageUrl: input.imageUrl ?? null,
    },
  })
}
