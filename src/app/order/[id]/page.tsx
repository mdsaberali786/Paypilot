import Link from 'next/link'
import { notFound } from 'next/navigation'
import Layout from '@/components/layout/Layout'
import { formatCurrency } from '@/lib/currency'
import { getOrderById } from '@/services/orderService'
import { getPaymentForOrder } from '@/services/paymentService'
import { createRazorpayOrder } from '@/services/paymentService'
import { canAccessBuyerOrder, getCurrentBuyer } from '@/services/buyerAuth'
import OrderPaymentSection from '@/components/payment/OrderPaymentSection'

export const dynamic = 'force-dynamic'

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (typeof id !== 'string' || !id.trim()) {
    notFound()
  }

  const order = await getOrderById(id)
  if (!order) notFound()
  const buyer = await getCurrentBuyer()
  if (!canAccessBuyerOrder(order.buyerId, buyer?.id ?? null)) notFound()

  const payment = await getPaymentForOrder(id)
  let paymentInfo: {
    razorpayOrderId: string
    keyId: string
    amount: number
  } | null = null
  let paymentStatus: string | null = payment?.status ?? null
  let paymentFailureReason: string | null = payment?.failureReason ?? null

  if (order.status === 'PENDING' || order.status === 'CONFIRMED') {
    if (!payment || !payment.providerOrderId || payment.status === 'FAILED') {
      const newPayment = await createRazorpayOrder(id)
      paymentInfo = { razorpayOrderId: newPayment.providerOrderId, keyId: newPayment.keyId, amount: newPayment.amount }
      paymentStatus = 'PENDING'
      paymentFailureReason = null
    } else if (payment.status === 'PENDING' || payment.status === 'PROCESSING') {
      paymentInfo = {
        razorpayOrderId: payment.providerOrderId,
        keyId: process.env.RAZORPAY_KEY_ID || '',
        amount: Math.round(Number(payment.amount) * 100),
      }
      paymentStatus = payment.status
      paymentFailureReason = payment.failureReason
    } else {
      paymentStatus = payment.status
      paymentFailureReason = payment.failureReason
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-700">Order confirmed</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Thank you for your order</h1>
          <p className="mt-2 text-gray-700">
            {order.status === 'CONFIRMED' ? 'Payment confirmed. Your order is being processed.' : 'Your order is pending payment confirmation.'}
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Order ID</p>
              <p className="mt-1 break-all font-mono text-sm font-medium text-gray-900">{order.id}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                order.status === 'CONFIRMED'
                  ? 'bg-green-100 text-green-700'
                  : order.status === 'CANCELLED'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {order.status}
            </span>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-5">
            <h2 className="font-semibold text-gray-900">Purchased items</h2>
            <div className="mt-4 space-y-3">
              {order.orderItems.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 text-sm">
                  <span className="text-gray-700">
                    {item.product.name} <span className="text-gray-500">× {item.quantity}</span>
                  </span>
                  <span className="font-medium text-gray-900">{formatCurrency(Number(item.unitPrice) * item.quantity, order.currency)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-between border-t border-gray-200 pt-5 text-lg font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(Number(order.totalAmount), order.currency)}</span>
            </div>
          </div>
        </div>

        {paymentInfo && <OrderPaymentSection orderId={order.id} paymentInfo={paymentInfo} currency={order.currency} orderStatus={order.status} paymentStatus={paymentStatus} paymentFailureReason={paymentFailureReason} />}

        <div className="mt-6 text-center">
          <Link href="/shop" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Continue shopping
          </Link>
        </div>
      </div>
    </Layout>
  )
}
