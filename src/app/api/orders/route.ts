import { CheckoutValidationError, createCustomerOrder, type CheckoutItemInput } from '@/services/checkoutService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid checkout request.' }, { status: 400 })
    }

    const { items, checkoutKey } = body as { items?: unknown; checkoutKey?: unknown }
    const result = await createCustomerOrder(
      Array.isArray(items) ? items as CheckoutItemInput[] : [],
      typeof checkoutKey === 'string' ? checkoutKey : '',
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
