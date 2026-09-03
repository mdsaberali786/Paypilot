import { redirect } from 'next/navigation'
import Layout from '@/components/layout/Layout'
import { getCurrentBuyer } from '@/services/buyerAuth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/currency'

export const dynamic = 'force-dynamic'

export default async function BuyerOrdersPage() {
  const buyer = await getCurrentBuyer()
  if (!buyer) redirect('/buyer/login?next=/buyer/orders')
  const orders = await prisma.order.findMany({
    where: { buyerId: buyer.id },
    include: { orderItems: { include: { product: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  })
  return <Layout><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Buyer account</p><h1 className="mt-3 text-4xl font-semibold text-white">Your orders</h1><p className="mt-2 text-slate-400">Only orders associated with your account are shown here.</p><div className="mt-8 space-y-4">{orders.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 text-slate-300">You have no orders yet.</div> : orders.map((order) => <article key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.06] p-6"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold text-white">Order #{order.id.slice(0, 8)}</h2><p className="mt-1 text-sm text-slate-400">{new Date(order.createdAt).toLocaleString()}</p></div><div className="text-right"><p className="font-semibold text-white">{formatCurrency(Number(order.totalAmount), order.currency)}</p><p className="mt-1 text-sm text-cyan-300">{order.status} · {order.payments[0]?.status ?? 'No payment'}</p></div></div><p className="mt-4 text-sm text-slate-300">{order.orderItems.map((item) => `${item.product.name} × ${item.quantity}`).join(', ')}</p></article>)}</div></main></Layout>
}
