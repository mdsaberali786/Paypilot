'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart'

type Product = {
  id: string
  name: string
  price: number
  currency: string
  inventory: number
  imageUrl?: string | null
}

export default function ProductPurchaseControls({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { items, addItem, updateQuantity } = useCart()
  const cartItem = items.find((item) => item.productId === product.id)

  if (!cartItem) {
    return (
      <button
        type="button"
        disabled={product.inventory < 1}
        onClick={() => addItem({ productId: product.id, name: product.name, price: product.price, currency: product.currency, inventory: product.inventory, imageUrl: product.imageUrl })}
        className={compact ? 'rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300' : 'w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300'}
      >
        {product.inventory < 1 ? 'Out of Stock' : 'Add to Cart'}
      </button>
    )
  }

  return (
    <div className={compact ? 'flex flex-wrap items-center justify-end gap-2' : 'flex flex-wrap items-center gap-3'}>
      <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
        <button type="button" aria-label={`Decrease quantity for ${product.name}`} disabled={cartItem.quantity <= 1} onClick={() => updateQuantity(product.id, cartItem.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">−</button>
        <span className="min-w-8 text-center text-sm font-semibold text-slate-900">{cartItem.quantity}</span>
        <button type="button" aria-label={`Increase quantity for ${product.name}`} disabled={cartItem.quantity >= product.inventory} onClick={() => updateQuantity(product.id, cartItem.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">+</button>
      </div>
      <Link href="/cart" className={compact ? 'rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700' : 'rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50'}>View Cart</Link>
    </div>
  )
}
