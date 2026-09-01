import { getActiveProducts } from '@/services/productService'
import Layout from '@/components/layout/Layout'
import ShopCatalog from '@/components/shop/ShopCatalog'

export const dynamic = 'force-dynamic'

export default async function ShopPage() {
  const products = await getActiveProducts()

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shop</h1>
          <p className="mt-2 text-gray-600">Browse our curated collection of products</p>
        </div>
        {products.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center"><p className="text-lg text-gray-600">No products available at the moment.</p></div>
        ) : (
          <ShopCatalog products={products.map((product) => ({ ...product, price: Number(product.price) }))} />
        )}
      </div>
    </Layout>
  )
}
