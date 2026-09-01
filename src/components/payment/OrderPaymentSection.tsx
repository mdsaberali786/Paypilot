'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RazorpayCheckout from './RazorpayCheckout'

interface OrderPaymentSectionProps {
  orderId: string
  paymentInfo: {
    razorpayOrderId: string
    keyId: string
    amount: number
  }
  currency: string
  orderStatus?: string
  paymentStatus?: string | null
  paymentFailureReason?: string | null
}

export default function OrderPaymentSection({ orderId, paymentInfo, currency, orderStatus, paymentStatus, paymentFailureReason }: OrderPaymentSectionProps) {
  const router = useRouter()
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [currentPaymentInfo, setCurrentPaymentInfo] = useState<typeof paymentInfo | null>(null)
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const activePaymentInfo = currentPaymentInfo ?? paymentInfo
  const activePaymentStatus = currentPaymentStatus ?? paymentStatus ?? 'PENDING'

  function handlePaymentSuccess() {
    setPaymentSuccess(true)
    setCurrentPaymentStatus('COMPLETED')
    router.refresh()
  }

  async function handleRetryPayment() {
    setRetrying(true)
    setRetryError(null)
    try {
      const response = await fetch('/api/payments/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const payload = await response.json() as { error?: string; providerOrderId?: string; keyId?: string; amount?: number; paypilotOrderId?: string }
      if (!response.ok || !payload.providerOrderId || !payload.keyId) {
        throw new Error(payload.error || 'Unable to retry payment right now.')
      }
      setCurrentPaymentInfo({
        razorpayOrderId: payload.providerOrderId,
        keyId: payload.keyId,
        amount: Number(payload.amount ?? 0),
      })
      setCurrentPaymentStatus('PENDING')
      setPaymentSuccess(false)
      router.refresh()
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'Unable to retry payment right now.')
    } finally {
      setRetrying(false)
    }
  }

  if (paymentSuccess || orderStatus === 'CONFIRMED' || activePaymentStatus === 'COMPLETED') {
    return (
      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-6">
        <p className="text-sm font-semibold text-green-700">Payment Verified</p>
        <p className="mt-2 text-gray-700">Your payment has been confirmed. Your order is now being processed.</p>
      </div>
    )
  }

  if (activePaymentStatus === 'FAILED' || paymentFailureReason) {
    return (
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-700">Payment not completed</p>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">We could not confirm the payment for this order.</h2>
        <p className="mt-2 text-sm text-gray-700">
          {paymentFailureReason || 'Please retry the payment using the secure Razorpay checkout below.'}
        </p>
        {retryError && <p className="mt-3 text-sm text-red-700">{retryError}</p>}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleRetryPayment}
            disabled={retrying}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? 'Retrying payment...' : 'Retry Payment'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
      <h2 className="text-lg font-semibold text-gray-900">Complete payment</h2>
      <p className="mt-2 text-sm text-gray-700">Click below to securely pay for your order with Razorpay.</p>
      <div className="mt-4">
        <RazorpayCheckout
          orderId={orderId}
          amount={activePaymentInfo.amount / 100}
          currency={currency}
          keyId={activePaymentInfo.keyId}
          razorpayOrderId={activePaymentInfo.razorpayOrderId}
          onPaymentSuccess={handlePaymentSuccess}
        />
      </div>
    </div>
  )
}
