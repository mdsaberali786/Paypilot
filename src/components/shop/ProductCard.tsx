'use client'

import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'
import ProductPurchaseControls from './ProductPurchaseControls'

interface ProductCardProps {
  id: string
  name: string
  description: string
  price: number
  currency: string
  category: string
  inventory: number
  imageUrl?: string | null
}

export default function ProductCard({ id, name, description, price, currency, category, inventory, imageUrl }: ProductCardProps) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
      <div className="relative flex aspect-[4/3] items-end overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-100 p-5">
        {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/50 blur-2xl" />
        <span className="relative rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700 backdrop-blur">{category}</span>
      </div>
      <div className="p-5">
        <h2 className="text-lg font-semibold text-slate-950">{name}</h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div><p className="text-xl font-semibold text-slate-950">{formatCurrency(price, currency)}</p><p className={inventory > 0 ? 'mt-1 text-xs text-emerald-700' : 'mt-1 text-xs text-rose-700'}>{inventory > 0 ? `${inventory} available` : 'Out of stock'}</p></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href={`/shop/${id}`} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400">Details</Link>
            <ProductPurchaseControls product={{ id, name, price, currency, inventory, imageUrl }} compact />
          </div>
        </div>
      </div>
    </article>
  )
}
