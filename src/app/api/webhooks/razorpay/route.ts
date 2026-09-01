import { PaymentValidationError, handleRazorpayWebhook } from '@/services/paymentService'

export const runtime = 'nodejs'

async function getRawBody(request: Request): Promise<string> {
  const blob = await request.blob()
  const reader = blob.stream().pipeThrough(new TextDecoderStream()).getReader()
  const result = await reader.read()
  return result.value || ''
}

export async function POST(request: Request) {
  try {
    const rawBody = await getRawBody(request)
    const signature = request.headers.get('x-razorpay-signature')
    const eventId = request.headers.get('x-razorpay-event-id')

    const result = await handleRazorpayWebhook(rawBody, signature, eventId)

    if (result.ignored) {
      return Response.json({ received: true, ignored: true }, { status: 200 })
    }

    return Response.json({ received: true }, { status: 200 })
  } catch (error) {
    if (error instanceof PaymentValidationError) {
      console.warn('Webhook validation failed', error.message)
      return Response.json({ error: error.message }, { status: 403 })
    }
    console.error('Webhook processing failed', error)
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
