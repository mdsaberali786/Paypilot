'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/currency'
import { useCart } from '@/lib/cart'

type Product = { id: string; name: string; description: string; price: number; currency: string; category: string; inventory: number; imageUrl?: string | null }
type CartLine = { productId: string; name: string; quantity: number; price: number; currency: string; imageUrl?: string | null }
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
  return { productId: product.id, name: product.name, price: product.price, currency: product.currency, inventory: product.inventory, imageUrl: product.imageUrl }
}

export default function AssistantExperience({ initialOpen = false }: { initialOpen?: boolean }) {
  const router = useRouter()
  const { items, isReady, itemCount, subtotal, currency, addItem, clearCart } = useCart()
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', content: 'Welcome to PayPilot. Tell me what you are shopping for, your budget, or what you need it for.' }])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isOpen, setIsOpen] = useState(initialOpen)
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

  async function sendMessage(event?: FormEvent, prompt?: string) {
    event?.preventDefault()
    const content = (prompt ?? input).trim()
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

  return <div className="fixed bottom-5 right-5 z-50 sm:bottom-7 sm:right-7">
    {isOpen && <section className="mb-3 flex h-[min(72vh,680px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl shadow-slate-950/30">
      <div className="flex items-start justify-between bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 p-5 text-white">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">PayPilot AI</p><h2 className="mt-1 text-xl font-semibold">Your shopping copilot</h2><p className="mt-1 text-sm text-blue-100/70">Find something that fits your day.</p></div>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close assistant" className="rounded-full p-2 text-blue-100 hover:bg-white/10">×</button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4" aria-live="polite">
        {messages.length === 1 && <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><p className="font-medium text-slate-950">Hi! What are you shopping for?</p><div className="mt-3 flex flex-wrap gap-2">{['Find a table under ₹5,000', 'Help me choose', 'Show me popular products'].map((prompt) => <button key={prompt} type="button" onClick={() => void sendMessage(undefined, prompt)} className="rounded-full border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50">{prompt}</button>)}</div></div>}
        {messages.map((message) => <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[88%]' : 'max-w-[94%]'}><div className={message.role === 'user' ? 'rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm leading-6 text-white' : 'rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm'}>{message.content}</div>{message.products && message.products.length > 0 && <div className="mt-3 space-y-3">{message.products.map((product) => <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="relative flex aspect-[3/1] items-end overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-cyan-100 p-3">{product.imageUrl && <img src={product.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}<span className="relative rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{product.category}</span></div><h3 className="mt-3 font-semibold text-slate-950">{product.name}</h3><div className="mt-2 flex items-center justify-between gap-3"><div><p className="font-semibold text-slate-950">{formatCurrency(product.price, product.currency)}</p><p className="text-xs text-emerald-700">{product.inventory > 0 ? 'Available' : 'Unavailable'}</p></div><button type="button" onClick={() => addItem(cartProduct(product))} disabled={product.inventory < 1} className="rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300">Add to cart</button></div></article>)}</div>}</div>)}
        {isSending && <div className="flex items-center gap-2 text-sm text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />{activity}</div>}
      </div>
      <div className="border-t border-slate-200 bg-white p-3"><div className="mb-3 flex items-center justify-between text-xs text-slate-500"><span>{itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatCurrency(subtotal, currency)}</span><Link href="/cart" className="font-semibold text-blue-700 hover:text-blue-800">View cart</Link></div>{items.length > 0 && <button type="button" onClick={reviewOrder} disabled={isReviewing} className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">{isReviewing ? 'Reviewing live cart…' : 'Review order securely'}</button>}{summary?.cartKey === cartKey && <div className="mb-3 rounded-xl bg-blue-50 p-3 text-xs text-slate-700"><p className="font-semibold text-slate-950">Server-verified total: {formatCurrency(summary.total, summary.currency)}</p><button type="button" onClick={confirmOrder} disabled={isConfirming} className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">{isConfirming ? 'Placing secure order…' : 'Yes, place this order'}</button></div>}{error && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}<form onSubmit={sendMessage} className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} disabled={isSending || !isReady} maxLength={4000} placeholder="Ask about products..." className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100" /><button type="submit" disabled={isSending || !input.trim() || !isReady} className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300">Send</button></form></div>
    </section>}
    <button type="button" onClick={() => setIsOpen((open) => !open)} aria-label="Open PayPilot AI shopping assistant" className="ml-auto flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-slate-950/25 ring-1 ring-slate-200 hover:-translate-y-1 hover:bg-cyan-50"><span className="text-lg">✦</span><span>PayPilot AI</span></button>
  </div>
}
