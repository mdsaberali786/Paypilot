'use client'

import { useCart } from '@/lib/cart'

type Product = { id: string; name: string; price: number; currency: string; inventory: number }

export default function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart()
  const unavailable = product.inventory < 1
  return <button type="button" disabled={unavailable} onClick={() => addItem({ productId: product.id, name: product.name, price: product.price, currency: product.currency, inventory: product.inventory })} className="w-full rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400">{unavailable ? 'Out of Stock' : 'Add to Cart'}</button>
}
