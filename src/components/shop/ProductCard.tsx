'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart'
import { formatCurrency } from '@/lib/currency'

interface ProductCardProps {
  id: string
  name: string
  description: string
  price: number
  currency: string
  category: string
  inventory: number
}

export default function ProductCard({ id, name, description, price, currency, category, inventory }: ProductCardProps) {
  const { addItem } = useCart()

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4"><span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">{category}</span></div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{name}</h3>
      <p className="mb-4 text-sm text-gray-600 line-clamp-2">{description}</p>
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-2xl font-bold text-gray-900">{formatCurrency(price, currency)}</span>
          {inventory > 0 && inventory <= 10 && <span className="ml-2 text-xs text-orange-600">Only {inventory} left</span>}
        </div>
        <div className="flex gap-2">
          <Link href={`/shop/${id}`} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Details</Link>
          <button type="button" disabled={inventory === 0} onClick={() => addItem({ productId: id, name, price, currency, inventory })} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400">Add</button>
        </div>
      </div>
      {inventory === 0 && <p className="mt-2 text-sm text-red-600">Out of stock</p>}
    </div>
  )
}
