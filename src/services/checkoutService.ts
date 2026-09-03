import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type CheckoutItemInput = {
  productId: string
  quantity: number
}

export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckoutValidationError'
  }
}

function normaliseItems(items: CheckoutItemInput[]) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    throw new CheckoutValidationError('Your cart is empty or contains too many items.')
  }

  const quantities = new Map<string, number>()
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new CheckoutValidationError('Each cart item must have a valid product and quantity.')
    }
    const quantity = (quantities.get(item.productId) ?? 0) + item.quantity
    if (quantity > 1000) throw new CheckoutValidationError('Requested quantity is too large.')
    quantities.set(item.productId, quantity)
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
}

export async function createCustomerOrder(items: CheckoutItemInput[], checkoutKey: string, buyerId?: string) {
  const normalisedItems = normaliseItems(items)
  if (typeof checkoutKey !== 'string' || checkoutKey.length < 16 || checkoutKey.length > 100) {
    throw new CheckoutValidationError('Invalid checkout request. Please try again.')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { checkoutKey },
        include: { orderItems: { include: { product: true } } },
      })
      if (existingOrder) return { order: existingOrder, duplicate: true }

      const products = await tx.product.findMany({
        where: { id: { in: normalisedItems.map((item) => item.productId) } },
      })
      if (products.length !== normalisedItems.length) {
        throw new CheckoutValidationError('One or more products are no longer available.')
      }
      if (products.some((product) => !product.active)) {
        throw new CheckoutValidationError('One or more products are no longer available.')
      }

      const merchantIds = new Set(products.map((product) => product.merchantId))
      const currencies = new Set(products.map((product) => product.currency))
      if (merchantIds.size !== 1 || currencies.size !== 1) {
        throw new CheckoutValidationError('Items from different stores or currencies cannot be checked out together.')
      }

      const productById = new Map(products.map((product) => [product.id, product]))
      const merchantId = products[0].merchantId
      const currency = products[0].currency
      for (const item of normalisedItems) {
        const reserved = await tx.product.updateMany({
          where: { id: item.productId, active: true, inventory: { gte: item.quantity } },
          data: { inventory: { decrement: item.quantity } },
        })
        if (reserved.count !== 1) {
          const product = productById.get(item.productId)
          await tx.auditLog.create({
            data: {
              merchantId,
              action: 'INVENTORY_RECOVERY_TRIGGERED',
              reason: 'Insufficient inventory blocked checkout recovery',
              metadata: {
                productId: item.productId,
                requestedQuantity: item.quantity,
                availableInventory: product?.inventory ?? 0,
                checkoutKey,
                buyerId,
              },
            },
          })
          throw new CheckoutValidationError(`Insufficient inventory for ${product?.name ?? 'a product'}.`)
        }
      }

      const totalAmount = normalisedItems.reduce((total, item) => (
        total.plus(productById.get(item.productId)!.price.mul(item.quantity))
      ), new Prisma.Decimal(0))

      const order = await tx.order.create({
        data: {
          merchantId,
          checkoutKey,
          buyerId,
          status: 'PENDING',
          totalAmount,
          currency,
          orderItems: {
            create: normalisedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: productById.get(item.productId)!.price,
            })),
          },
        },
        include: { orderItems: { include: { product: true } } },
      })

      await tx.auditLog.create({
        data: {
          merchantId,
          orderId: order.id,
          action: 'ORDER_CREATED',
          reason: 'Customer checkout completed',
          metadata: { itemCount: normalisedItems.length, checkoutKey },
        },
      })

      return { order, duplicate: false }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const order = await prisma.order.findUnique({
        where: { checkoutKey },
        include: { orderItems: { include: { product: true } } },
      })
      if (order) return { order, duplicate: true }
    }
    throw error
  }
}
