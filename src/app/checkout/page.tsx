'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/layout/Layout'
import { useCart } from '@/lib/cart'
import { formatCurrency } from '@/lib/currency'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, isReady, subtotal, currency, clearCart } = useCart()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const checkoutKey = useRef<string | null>(null)

  async function submitOrder() {
    if (isSubmitting || items.length === 0) return
    checkoutKey.current ??= crypto.randomUUID()
    setIsSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkoutKey: checkoutKey.current, items: items.map(({ productId, quantity }) => ({ productId, quantity })) }) })
      const result = await response.json() as { orderId?: string; error?: string }
      if (!response.ok || !result.orderId) throw new Error(result.error || 'Unable to create your order.')
      clearCart()
      router.push(`/order/${result.orderId}`)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to create your order.')
      setIsSubmitting(false)
    }
  }

  if (!isReady) return <Layout><div className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-600">Loading checkout…</div></Layout>
  if (items.length === 0) return <Layout><div className="mx-auto max-w-3xl px-4 py-16 text-center"><h1 className="text-3xl font-bold text-gray-900">Nothing to check out</h1><Link href="/shop" className="mt-6 inline-block text-blue-600 hover:text-blue-700">Browse products</Link></div></Layout>

  return <Layout><div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-bold text-gray-900">Checkout</h1><p className="mt-2 text-gray-600">Review your order. Payment will be collected in a later step.</p><div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-gray-900">Order summary</h2><div className="mt-4 space-y-3">{items.map((item) => <div key={item.productId} className="flex justify-between gap-4 text-sm"><span className="text-gray-700">{item.name} <span className="text-gray-500">× {item.quantity}</span></span><span className="font-medium text-gray-900">{formatCurrency(item.price * item.quantity, item.currency)}</span></div>)}</div><div className="mt-5 flex justify-between border-t border-gray-200 pt-5 text-lg font-semibold"><span>Total</span><span>{formatCurrency(subtotal, currency)}</span></div></div>{error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><Link href="/cart" className="rounded-md border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Back to cart</Link><button type="button" onClick={submitOrder} disabled={isSubmitting} className="rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400">{isSubmitting ? 'Creating order…' : 'Place order'}</button></div></div></Layout>
}
