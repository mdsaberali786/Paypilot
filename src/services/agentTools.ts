import { prisma } from '@/lib/prisma'
import { createCustomerOrder } from '@/services/checkoutService'

export type AgentCartItem = { productId: string; quantity: number }
export type AgentContext = { cart: AgentCartItem[]; confirmed: boolean; checkoutKey: string }
export type AgentAction = { tool: string; status: 'success' | 'blocked'; data?: unknown; message?: string }

export const allowedAgentTools = new Set(['search_products', 'get_product_details', 'check_inventory', 'add_to_cart', 'calculate_cart', 'create_order'])

export function validateAgentToolArguments(name: string, args: Record<string, unknown>) {
  if (!allowedAgentTools.has(name)) return 'This tool is not allowed.'
  if (['get_product_details', 'check_inventory', 'add_to_cart'].includes(name) && typeof args.productId !== 'string') return 'Invalid product ID.'
  if (['check_inventory', 'add_to_cart'].includes(name) && (!Number.isInteger(args.quantity) || (args.quantity as number) < 1)) return 'Quantity must be a positive integer.'
  if (name === 'search_products' && (typeof args.query !== 'string' || !args.query.trim())) return 'A search query is required.'
  return null
}

export async function auditAgentAction(reason: string, metadata: object, orderId?: string) {
  try {
    const merchant = await prisma.merchant.findFirst({ select: { id: true } })
    if (merchant) await prisma.auditLog.create({ data: { merchantId: merchant.id, orderId, action: 'AGENT_DECISION', reason, metadata } })
  } catch (error) {
    console.error('Agent audit logging failed', error)
  }
}

export const agentToolDefinitions = [
  { type: 'function', name: 'search_products', description: 'Search the live product catalog only when needed. Avoid repeating the same query or criteria; use returned results to answer the user, and search again only for materially different criteria or an unresolved need.', parameters: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, maximumPrice: { type: 'number' } }, required: ['query'] } },
  { type: 'function', name: 'get_product_details', description: 'Get authoritative details for one product.', parameters: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'] } },
  { type: 'function', name: 'check_inventory', description: 'Check live inventory for a requested quantity.', parameters: { type: 'object', properties: { productId: { type: 'string' }, quantity: { type: 'integer' } }, required: ['productId', 'quantity'] } },
  { type: 'function', name: 'add_to_cart', description: 'Add a valid in-stock product to the customer cart.', parameters: { type: 'object', properties: { productId: { type: 'string' }, quantity: { type: 'integer' } }, required: ['productId', 'quantity'] } },
  { type: 'function', name: 'calculate_cart', description: 'Calculate an authoritative cart total from product IDs and quantities.', parameters: { type: 'object', properties: {}, required: [] } },
  { type: 'function', name: 'create_order', description: 'Create the order only after explicit customer confirmation.', parameters: { type: 'object', properties: {}, required: [] } },
]

export async function executeAgentTool(name: string, args: Record<string, unknown>, context: AgentContext): Promise<AgentAction> {
  try {
    const validationError = validateAgentToolArguments(name, args)
    if (validationError) {
      await auditAgentAction('Blocked agent tool call', { tool: name, reason: validationError })
      return { tool: name, status: 'blocked', message: validationError }
    }
    const quantity = args.quantity
    const productId = args.productId
    const requestedQuantity = typeof quantity === 'number' ? quantity : 0

    if (name === 'search_products') {
      const query = typeof args.query === 'string' ? args.query.trim() : ''
      const category = typeof args.category === 'string' ? args.category : undefined
      const maximumPrice = typeof args.maximumPrice === 'number' && args.maximumPrice >= 0 ? args.maximumPrice : undefined
      const products = await prisma.product.findMany({ where: { active: true, ...(category ? { category } : {}), ...(maximumPrice !== undefined ? { price: { lte: maximumPrice } } : {}), OR: [{ name: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }, { category: { contains: query, mode: 'insensitive' } }] }, take: 8, select: { id: true, name: true, description: true, price: true, currency: true, category: true, inventory: true, imageUrl: true } })
      await auditAgentAction('Agent product search', { query, category, maximumPrice, resultCount: products.length })
      if (products.length > 0) await auditAgentAction('Agent product recommendations returned', { query, productIds: products.map((product) => product.id) })
      return { tool: name, status: 'success', data: products.map((p) => ({ ...p, price: Number(p.price) })) }
    }
    if (name === 'get_product_details') {
      const product = await prisma.product.findUnique({ where: { id: productId as string }, select: { id: true, name: true, description: true, price: true, currency: true, category: true, inventory: true, active: true, imageUrl: true } })
      if (!product) return { tool: name, status: 'blocked', message: 'Product not found.' }
      return { tool: name, status: 'success', data: { ...product, price: Number(product.price) } }
    }
    if (name === 'check_inventory') {
      const product = await prisma.product.findUnique({ where: { id: productId as string }, select: { id: true, name: true, description: true, category: true, price: true, currency: true, inventory: true, active: true } })
      if (!product || !product.active) return { tool: name, status: 'blocked', message: 'Product is unavailable.' }
      const available = product.inventory >= requestedQuantity
      await auditAgentAction('Agent inventory check', { productId, quantity, available })
      return { tool: name, status: 'success', data: { productId, available, inventory: product.inventory } }
    }
    if (name === 'add_to_cart') {
      const product = await prisma.product.findUnique({ where: { id: productId as string }, select: { id: true, name: true, description: true, category: true, price: true, currency: true, inventory: true, active: true } })
      if (!product || !product.active || product.inventory < requestedQuantity) return { tool: name, status: 'blocked', message: 'Product is unavailable in the requested quantity.' }
      await auditAgentAction('Agent cart modification', { productId, quantity })
      return { tool: name, status: 'success', data: { id: product.id, quantity, name: product.name, description: product.description, category: product.category, price: Number(product.price), currency: product.currency, inventory: product.inventory } }
    }
    if (name === 'calculate_cart') {
      const products = await prisma.product.findMany({ where: { id: { in: context.cart.map((item) => item.productId) }, active: true }, select: { id: true, name: true, price: true, currency: true, inventory: true } })
      const items = context.cart.map((item) => ({ product: products.find((product) => product.id === item.productId), quantity: item.quantity }))
      if (items.some((item) => !item.product)) return { tool: name, status: 'blocked', message: 'One or more cart products are no longer available.' }
      if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.product!.inventory < item.quantity)) return { tool: name, status: 'blocked', message: 'One or more cart items do not have enough inventory.' }
      if (new Set(items.map((item) => item.product!.currency)).size > 1) return { tool: name, status: 'blocked', message: 'Cart items must use the same currency.' }
      const total = items.reduce((sum, item) => sum + Number(item.product!.price) * item.quantity, 0)
      await auditAgentAction('Agent cart calculation', { itemCount: items.length, total })
      return { tool: name, status: 'success', data: { items: items.map((item) => ({ productId: item.product!.id, name: item.product!.name, quantity: item.quantity, price: Number(item.product!.price), currency: item.product!.currency })), total } }
    }
    if (name === 'create_order') {
      if (!context.confirmed) { await auditAgentAction('Blocked order creation request', { reason: 'missing explicit confirmation' }); return { tool: name, status: 'blocked', message: 'Ask the customer to explicitly confirm before creating an order.' } }
      const result = await createCustomerOrder(context.cart, context.checkoutKey)
      await auditAgentAction('Agent order creation result', { duplicate: result.duplicate }, result.order.id)
      return { tool: name, status: 'success', data: { orderId: result.order.id, total: Number(result.order.totalAmount), currency: result.order.currency } }
    }
    await auditAgentAction('Blocked agent tool call', { tool: name })
    return { tool: name, status: 'blocked', message: 'Tool is not allowed.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed.'
    await auditAgentAction('Blocked agent tool call', { tool: name, reason: message, safeFailure: true })
    return { tool: name, status: 'blocked', message: 'I could not complete that action right now. Please try again.' }
  }
}
