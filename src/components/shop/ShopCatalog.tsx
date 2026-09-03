'use client'

import { useMemo, useState } from 'react'
import ProductCard from './ProductCard'

type Product = { id: string; name: string; description: string; price: number; currency: string; category: string; inventory: number; imageUrl?: string | null }

export default function ShopCatalog({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((product) => product.category)))], [products])
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === 'All' || product.category === category
    const search = query.trim().toLowerCase()
    return matchesCategory && (!search || `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(search))
  }), [category, products, query])

  return (
    <>
      <div className="mb-8 grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto]">
        <label className="block"><span className="sr-only">Search products</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none ring-blue-500 placeholder:text-gray-400 focus:ring-2" /></label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500">{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      {filteredProducts.length === 0 ? <div className="rounded-lg border border-gray-200 bg-white p-12 text-center"><p className="text-lg font-medium text-gray-900">No matching products</p><p className="mt-2 text-gray-600">Try a different search or category.</p></div> : <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredProducts.map((product) => <ProductCard key={product.id} {...product} />)}</div>}
    </>
  )
}
