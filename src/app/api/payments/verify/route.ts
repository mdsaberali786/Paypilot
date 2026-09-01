import { PaymentValidationError, verifyRazorpayPayment } from '@/services/paymentService'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      paypilotOrderId?: unknown
      razorpayOrderId?: unknown
      razorpayPaymentId?: unknown
      razorpaySignature?: unknown
    }

    if (
      typeof body.paypilotOrderId !== 'string' ||
      typeof body.razorpayOrderId !== 'string' ||
      typeof body.razorpayPaymentId !== 'string' ||
      typeof body.razorpaySignature !== 'string'
    ) {
      return Response.json({ error: 'Invalid payment verification request.' }, { status: 400 })
    }

    const result = await verifyRazorpayPayment({
      paypilotOrderId: body.paypilotOrderId,
      providerOrderId: body.razorpayOrderId,
      providerPaymentId: body.razorpayPaymentId,
      signature: body.razorpaySignature,
    })

    return Response.json({
      success: true,
      orderId: result.order.id,
      status: result.order.status,
      isDuplicate: result.duplicate,
    })
  } catch (error) {
    if (error instanceof PaymentValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    console.error('Payment verification failed', error)
    return Response.json({ error: 'Unable to verify payment. Please try again.' }, { status: 500 })
  }
}
