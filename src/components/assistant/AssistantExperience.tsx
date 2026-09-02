'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/currency'
import { useCart } from '@/lib/cart'

type Product = { id: string; name: string; description: string; price: number; currency: string; category: string; inventory: number }
type CartLine = { productId: string; name: string; quantity: number; price: number; currency: string }
type AgentAction = { tool: string; status: 'success' | 'blocked'; data?: unknown; message?: string }
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; products?: Product[] }
type CartSummary = { items: CartLine[]; total: number; currency: string; cartKey: string }

export function shouldSurfaceBlockedToolError(actions: AgentAction[], assistantMessage?: string) {
  const blocked = actions.find((action) => action.status === 'blocked')
  if (!blocked?.message) return false
  return !assistantMessage || !assistantMessage.trim()
}

function actionLabel(input: string) {
  const value = input.toLowerCase()
  if (/add|cart/.test(value)) return 'Adding to cart...'
  if (/stock|available|inventory/.test(value)) return 'Checking availability...'
  if (/checkout|order|buy|place/.test(value)) return 'Preparing your order...'
  return 'Searching products...'
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false
  const product = value as Product
  return typeof product.id === 'string' && typeof product.name === 'string' && typeof product.description === 'string' && typeof product.price === 'number' && typeof product.currency === 'string' && typeof product.inventory === 'number'
}

function cartProduct(product: Product) {
  return { productId: product.id, name: product.name, price: product.price, currency: product.currency, inventory: product.inventory }
}

export default function AssistantExperience() {
  const router = useRouter()
  const { items, isReady, itemCount, subtotal, currency, addItem, clearCart } = useCart()
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', content: 'Welcome to PayPilot. Tell me what you are shopping for, your budget, or what you need it for.' }])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [activity, setActivity] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<CartSummary | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  const cartPayload = useMemo(() => items.map(({ productId, quantity }) => ({ productId, quantity })), [items])
  const cartKey = useMemo(() => cartPayload.map((item) => `${item.productId}:${item.quantity}`).sort().join('|'), [cartPayload])

  function addReturnedCartActions(actions: AgentAction[]) {
    for (const action of actions) {
      if (action.tool !== 'add_to_cart' || action.status !== 'success' || !isProduct(action.data)) continue
      const data = action.data as Product & { quantity?: number }
      addItem(cartProduct(data), typeof data.quantity === 'number' ? data.quantity : 1)
    }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault()
    const content = input.trim()
    if (!content || isSending || !isReady) return
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
    const outgoing = [...messages, userMessage]
    setMessages(outgoing)
    setInput('')
    setError('')
    setIsSending(true)
    setActivity(actionLabel(content))
    try {
      const response = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: outgoing.map(({ role, content: messageContent }) => ({ role, content: messageContent })), cart: cartPayload }) })
      const result = await response.json() as { message?: string; actions?: AgentAction[]; error?: string }
      if (!response.ok || !result.message) throw new Error(result.error || 'The assistant could not complete that request.')
      const actions = Array.isArray(result.actions) ? result.actions : []
      const products = actions.flatMap((action) => action.tool === 'search_products' && action.status === 'success' && Array.isArray(action.data) ? action.data.filter(isProduct) : [])
      addReturnedCartActions(actions)
      const assistantContent = result.message
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: assistantContent, products }])
      const blocked = actions.find((action) => action.status === 'blocked')
      if (blocked?.message && shouldSurfaceBlockedToolError(actions, assistantContent)) setError(blocked.message)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'A network error occurred. Please try again.')
    } finally {
      setActivity('')
      setIsSending(false)
    }
  }

  async function reviewOrder() {
    if (!cartPayload.length || isReviewing) return
    setError('')
    setIsReviewing(true)
    try {
      const response = await fetch('/api/agent/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'review', cart: cartPayload }) })
      const result = await response.json() as { status?: string; data?: CartSummary; message?: string; error?: string }
      if (!response.ok || result.status !== 'success' || !result.data) throw new Error(result.message || result.error || 'Unable to review this cart.')
      setSummary({ ...result.data, cartKey })
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: 'I verified the current cart against live prices and inventory. Review the secure order summary, then explicitly place the order when you are ready.' }])
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to review this cart.')
    } finally {
      setIsReviewing(false)
    }
  }

  async function confirmOrder() {
    if (!summary || summary.cartKey !== cartKey || isConfirming) return
    setError('')
    setIsConfirming(true)
    try {
      const response = await fetch('/api/agent/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', cart: cartPayload }) })
      const result = await response.json() as { status?: string; data?: { orderId: string }; message?: string; error?: string }
      if (!response.ok || result.status !== 'success' || !result.data?.orderId) throw new Error(result.message || result.error || 'Unable to place your order.')
      clearCart()
      router.push(`/order/${result.data.orderId}`)
    } catch (confirmationError) {
      setError(confirmationError instanceof Error ? confirmationError.message : 'Unable to place your order.')
    } finally {
      setIsConfirming(false)
    }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 to-blue-950 px-5 py-5 text-white sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">PayPilot Concierge</p>
        <h1 className="mt-1 text-2xl font-semibold">Shop with a commerce assistant</h1>
        <p className="mt-1 text-sm text-slate-300">Live catalog, inventory-aware recommendations, and a secure checkout review.</p>
      </div>
      <div className="h-[min(58vh,620px)] space-y-5 overflow-y-auto bg-slate-50 p-4 sm:p-6" aria-live="polite">
        {messages.map((message) => <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[88%]' : 'max-w-[92%]'}>
          <div className={message.role === 'user' ? 'rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm leading-6 text-white' : 'rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm'}>{message.content}</div>
          {message.products && message.products.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {message.products.map((product) => <article key={product.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">{product.category}</p>
              <h2 className="mt-1 font-semibold text-slate-950">{product.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{product.description}</p>
              <div className="mt-3 flex items-end justify-between gap-3"><div><p className="font-semibold text-slate-950">{formatCurrency(product.price, product.currency)}</p><p className={product.inventory > 0 ? 'text-xs text-emerald-700' : 'text-xs text-rose-700'}>{product.inventory > 0 ? `${product.inventory} available` : 'Unavailable'}</p></div><button type="button" onClick={() => addItem(cartProduct(product))} disabled={product.inventory < 1} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Add to cart</button></div>
            </article>)}
          </div>}
        </div>)}
        {isSending && <div className="flex items-center gap-2 text-sm text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />{activity}</div>}
      </div>
      <form onSubmit={sendMessage} className="border-t border-slate-200 p-4 sm:p-5"><div className="flex gap-3"><input value={input} onChange={(event) => setInput(event.target.value)} disabled={isSending || !isReady} maxLength={4000} placeholder="Ask about products, budgets, or what fits your needs" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-blue-500 placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-100" /><button type="submit" disabled={isSending || !input.trim() || !isReady} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">Send</button></div></form>
    </section>
    <aside className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-950">Your cart</p><p className="mt-1 text-sm text-slate-500">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p></div><Link href="/cart" className="text-sm font-semibold text-blue-700 hover:text-blue-800">View cart</Link></div>{items.length === 0 ? <p className="mt-5 text-sm text-slate-500">Recommendations you add here appear in your existing PayPilot cart.</p> : <><div className="mt-5 space-y-3 border-y border-slate-100 py-4">{items.map((item) => <div key={item.productId} className="flex justify-between gap-3 text-sm"><span className="text-slate-700">{item.name} <span className="text-slate-400">× {item.quantity}</span></span><span className="font-medium text-slate-950">{formatCurrency(item.price * item.quantity, item.currency)}</span></div>)}</div><div className="mt-4 flex justify-between font-semibold text-slate-950"><span>Estimated total</span><span>{formatCurrency(subtotal, currency)}</span></div><button type="button" onClick={reviewOrder} disabled={isReviewing} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400">{isReviewing ? 'Reviewing live cart…' : 'Review order securely'}</button></>}</section>
      {summary?.cartKey === cartKey && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Ready for confirmation</p><h2 className="mt-1 font-semibold text-slate-950">You&apos;re about to place this order</h2><div className="mt-4 space-y-2">{summary.items.map((item) => <div key={item.productId} className="flex justify-between gap-3 text-sm text-slate-700"><span>{item.name} × {item.quantity}</span><span>{formatCurrency(item.price * item.quantity, item.currency)}</span></div>)}</div><div className="mt-4 flex justify-between border-t border-blue-200 pt-4 font-semibold text-slate-950"><span>Server-verified total</span><span>{formatCurrency(summary.total, summary.currency)}</span></div><p className="mt-3 text-xs leading-5 text-slate-600">Changes to your cart require a new review. Payment is collected later.</p><button type="button" onClick={confirmOrder} disabled={isConfirming} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">{isConfirming ? 'Placing secure order…' : 'Yes, place this order'}</button></section>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    </aside>
  </div>
}
