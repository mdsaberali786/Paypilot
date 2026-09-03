'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart'

export default function Header() {
  const { itemCount, isReady } = useCart()
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080b12]/85 text-white backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="PayPilot home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-300 text-sm font-black text-slate-950">P</span>
          <span><span className="block text-lg font-semibold tracking-tight">PayPilot</span><span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">AI commerce</span></span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300" aria-label="Primary navigation">
          <Link href="/shop" className="hover:text-white">Shop</Link>
          <Link href="/shop" className="hover:text-white">Products</Link>
          <Link href="/cart" className="hover:text-white">Cart {isReady && itemCount > 0 && <span className="ml-1 rounded-full bg-blue-400 px-2 py-0.5 text-xs font-bold text-slate-950">{itemCount}</span>}</Link>
          <Link href="/assistant" className="hover:text-white">AI Assistant</Link>
          <Link href="/buyer/login" className="rounded-full border border-white/15 px-4 py-2 font-medium text-white hover:border-blue-300 hover:bg-white/10">Buyer Login</Link>
          <Link href="/seller/login" className="text-slate-400 hover:text-white">Seller</Link>
        </nav>
      </div>
    </header>
  )
}
