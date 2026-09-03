import { CheckoutValidationError, createCustomerOrder, type CheckoutItemInput } from '@/services/checkoutService'
import { getCurrentBuyer } from '@/services/buyerAuth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid checkout request.' }, { status: 400 })
    }

    const { items, checkoutKey } = body as { items?: unknown; checkoutKey?: unknown }
    const buyer = await getCurrentBuyer()
    if (!buyer) return Response.json({ error: 'Please sign in before placing an order.' }, { status: 401 })
    const result = await createCustomerOrder(
      Array.isArray(items) ? items as CheckoutItemInput[] : [],
      typeof checkoutKey === 'string' ? checkoutKey : '',
      buyer.id,
    )
    return Response.json({ orderId: result.order.id, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 201 })
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    console.error('Order creation failed', error)
    return Response.json({ error: 'Unable to create your order. Please try again.' }, { status: 500 })
  }
}
