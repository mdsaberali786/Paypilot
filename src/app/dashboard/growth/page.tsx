import DashboardLayout from '@/components/dashboard/DashboardLayout'
import GrowthInsightPanel from '@/components/dashboard/GrowthInsightPanel'
import { requireSeller } from '@/services/sellerAuth'
import { getMerchantGrowthAnalytics } from '@/services/growthAnalytics'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function GrowthPage({ searchParams }: { searchParams?: Promise<{ days?: string }> }) {
  const seller = await requireSeller()
  const requestedDays = Number((await searchParams)?.days ?? 30)
  const analytics = await getMerchantGrowthAnalytics(seller.id, Number.isInteger(requestedDays) ? requestedDays : 30)
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Merchant intelligence</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Growth</h1>
          <p className="mt-2 text-slate-500">Your store performance for the last {analytics.periodDays} days.</p>
          <div className="mt-4 flex gap-2">
            {[7, 30].map((days) => <Link key={days} href={`/dashboard/growth?days=${days}`} className={`rounded-lg px-3 py-2 text-sm font-medium ${analytics.periodDays === days ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{days} days</Link>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            ['Revenue', `₹${Math.round(analytics.revenue).toLocaleString()}`],
            ['Orders', analytics.orders],
            ['Paid orders', analytics.paidOrders],
            ['Conversion', `${analytics.conversionRate}%`],
            ['Failed payments', analytics.failedPayments],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>)}
        </div>
        <GrowthInsightPanel periodDays={analytics.periodDays} supportingMetrics={{ orders: analytics.orders, conversionRate: analytics.conversionRate }} />
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4"><h2 className="text-lg font-semibold text-slate-950">Product performance</h2></div>
          {analytics.productPerformance.length === 0 ? <p className="p-6 text-sm text-slate-500">No paid product sales in this period.</p> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{['Product', 'Category', 'Units sold', 'Revenue', 'Orders', 'Inventory'].map((heading) => <th key={heading} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{analytics.productPerformance.map((product) => <tr key={product.productId}><td className="px-6 py-4 text-sm font-medium text-slate-900">{product.name}</td><td className="px-6 py-4 text-sm text-slate-600">{product.category}</td><td className="px-6 py-4 text-sm text-slate-600">{product.unitsSold}</td><td className="px-6 py-4 text-sm text-slate-600">₹{Math.round(product.revenue).toLocaleString()}</td><td className="px-6 py-4 text-sm text-slate-600">{product.orders}</td><td className="px-6 py-4 text-sm text-slate-600">{product.inventory}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </DashboardLayout>
  )
}
