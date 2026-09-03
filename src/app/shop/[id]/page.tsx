import { getProductById } from '@/services/productService'
import Layout from '@/components/layout/Layout'
import { notFound } from 'next/navigation'
import ProductPurchaseControls from '@/components/shop/ProductPurchaseControls'
import { formatCurrency } from '@/lib/currency'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProductById(id)
  if (!product) notFound()

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <div className="text-center"><p className="mt-2 text-sm text-gray-500">Product Image</p></div>}</div>
            <div>
              <div className="mb-4"><span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">{product.category}</span></div>
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              <p className="mt-4 text-lg text-gray-600">{product.description}</p>
              <div className="mt-6"><span className="text-4xl font-bold text-gray-900">{formatCurrency(Number(product.price), product.currency)}</span></div>
              <div className="mt-6 space-y-4"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">Availability:</span><span className={`text-sm font-medium ${product.inventory > 10 ? 'text-green-600' : product.inventory > 0 ? 'text-orange-600' : 'text-red-600'}`}>{product.inventory > 10 ? 'In Stock' : product.inventory > 0 ? `Only ${product.inventory} left` : 'Out of Stock'}</span></div><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">Sold by:</span><span className="text-sm text-gray-600">{product.merchant.name}</span></div></div>
              <div className="mt-8"><ProductPurchaseControls product={{ id: product.id, name: product.name, price: Number(product.price), currency: product.currency, inventory: product.inventory, imageUrl: product.imageUrl }} /></div>
              <div className="mt-6 rounded-md bg-gray-50 p-4"><h3 className="text-sm font-medium text-gray-900">Product Details</h3><dl className="mt-2 space-y-2"><div className="flex justify-between"><dt className="text-sm text-gray-600">Category</dt><dd className="text-sm font-medium text-gray-900">{product.category}</dd></div><div className="flex justify-between"><dt className="text-sm text-gray-600">SKU</dt><dd className="text-sm font-medium text-gray-900">{product.id}</dd></div><div className="flex justify-between"><dt className="text-sm text-gray-600">Currency</dt><dd className="text-sm font-medium text-gray-900">{product.currency}</dd></div></dl></div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
