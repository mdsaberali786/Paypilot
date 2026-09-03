import { PaymentValidationError, retryRazorpayPayment } from '@/services/paymentService'
import { getCurrentBuyer } from '@/services/buyerAuth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { orderId?: unknown }
    if (typeof body.orderId !== 'string' || !body.orderId.trim()) {
      return Response.json({ error: 'Invalid order ID.' }, { status: 400 })
    }
    const buyer = await getCurrentBuyer()
    if (!buyer) return Response.json({ error: 'Buyer authentication required.' }, { status: 401 })

    const result = await retryRazorpayPayment(body.orderId, buyer.id)
    return Response.json({
      success: true,
      paypilotOrderId: result.paypilotOrderId,
      providerOrderId: result.providerOrderId,
      keyId: result.keyId,
      amount: result.amount,
      currency: result.currency,
    })
  } catch (error) {
    if (error instanceof PaymentValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    console.error('Payment retry failed', error)
    return Response.json({ error: 'Unable to retry payment right now. Please try again.' }, { status: 500 })
  }
}
