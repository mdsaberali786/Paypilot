import { getProductById } from '@/services/productService'
import Layout from '@/components/layout/Layout'
import { notFound } from 'next/navigation'
import AddToCartButton from '@/components/shop/AddToCartButton'
import { formatCurrency } from '@/lib/currency'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProductById(params.id)
  if (!product) notFound()

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100"><div className="text-center"><svg className="mx-auto h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p className="mt-2 text-sm text-gray-500">Product Image</p></div></div>
            <div>
              <div className="mb-4"><span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">{product.category}</span></div>
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              <p className="mt-4 text-lg text-gray-600">{product.description}</p>
              <div className="mt-6"><span className="text-4xl font-bold text-gray-900">{formatCurrency(Number(product.price), product.currency)}</span></div>
              <div className="mt-6 space-y-4"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">Availability:</span><span className={`text-sm font-medium ${product.inventory > 10 ? 'text-green-600' : product.inventory > 0 ? 'text-orange-600' : 'text-red-600'}`}>{product.inventory > 10 ? 'In Stock' : product.inventory > 0 ? `Only ${product.inventory} left` : 'Out of Stock'}</span></div><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">Sold by:</span><span className="text-sm text-gray-600">{product.merchant.name}</span></div></div>
              <div className="mt-8"><AddToCartButton product={{ id: product.id, name: product.name, price: Number(product.price), currency: product.currency, inventory: product.inventory }} /></div>
              <div className="mt-6 rounded-md bg-gray-50 p-4"><h3 className="text-sm font-medium text-gray-900">Product Details</h3><dl className="mt-2 space-y-2"><div className="flex justify-between"><dt className="text-sm text-gray-600">Category</dt><dd className="text-sm font-medium text-gray-900">{product.category}</dd></div><div className="flex justify-between"><dt className="text-sm text-gray-600">SKU</dt><dd className="text-sm font-medium text-gray-900">{product.id}</dd></div><div className="flex justify-between"><dt className="text-sm text-gray-600">Currency</dt><dd className="text-sm font-medium text-gray-900">{product.currency}</dd></div></dl></div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
