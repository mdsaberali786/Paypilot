import { getActiveProducts } from '@/services/productService'
import Layout from '@/components/layout/Layout'
import ShopCatalog from '@/components/shop/ShopCatalog'

export const dynamic = 'force-dynamic'

export default async function ShopPage() {
  const products = await getActiveProducts()

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">PayPilot collection</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Products worth a closer look.</h1>
          <p className="mt-3 max-w-xl text-slate-500">Browse a focused catalog, or ask the AI copilot to narrow it down.</p>
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
