'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/currency'

interface RazorpayCheckoutProps {
  orderId: string
  amount: number
  currency: string
  keyId: string
  razorpayOrderId: string
  customerName?: string
  customerEmail?: string
  onPaymentSuccess?: (paymentId: string) => void
  onPaymentError?: (error: string) => void
}

declare global {
  interface Window {
    Razorpay: unknown
  }
}

export default function RazorpayCheckout({
  orderId,
  amount,
  currency,
  keyId,
  razorpayOrderId,
  customerName,
  customerEmail,
  onPaymentSuccess,
  onPaymentError,
}: RazorpayCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script)
    }
  }, [])

  async function handlePayment() {
    if (isLoading) return
    setIsLoading(true)
    setError('')

    try {
      if (!window.Razorpay) {
        throw new Error('Payment gateway is not available. Please try again.')
      }

      const options: Record<string, unknown> = {
        key: keyId,
        order_id: razorpayOrderId,
        amount: Math.round(amount * 100),
        currency,
        name: 'PayPilot',
        description: `Order #${orderId}`,
        handler: async (response: Record<string, unknown>) => {
          try {
            const verifyResponse = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paypilotOrderId: orderId,
                razorpayOrderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            })

            const result = await verifyResponse.json() as { success?: boolean; error?: string }
            if (!verifyResponse.ok || !result.success) {
              throw new Error(result.error || 'Payment verification failed')
            }

            onPaymentSuccess?.(response.razorpay_payment_id as string)
          } catch (verifyError) {
            const errorMessage = verifyError instanceof Error ? verifyError.message : 'Payment verification failed'
            setError(errorMessage)
            onPaymentError?.(errorMessage)
            setIsLoading(false)
          }
        },
        prefill: {
          ...(customerName ? { name: customerName } : {}),
          ...(customerEmail ? { email: customerEmail } : {}),
        },
        theme: { color: '#2563eb' },
        modal: {
          ondismiss: () => {
            setIsLoading(false)
            setError('Payment cancelled')
          },
        },
      }

      const razorpayInstance = new (window.Razorpay as any)(options) // eslint-disable-line @typescript-eslint/no-explicit-any
      razorpayInstance.open()
    } catch (paymentError) {
      const errorMessage = paymentError instanceof Error ? paymentError.message : 'Payment failed'
      setError(errorMessage)
      onPaymentError?.(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={handlePayment}
        disabled={isLoading}
        className="w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
      >
        {isLoading ? 'Processing payment…' : `Pay ${formatCurrency(amount, currency)} securely with Razorpay`}
      </button>
    </div>
  )
}
