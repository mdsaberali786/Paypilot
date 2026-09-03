import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/dashboard/DashboardLayout'

export const dynamic = 'force-dynamic'

async function getPayments() {
  const merchant = await prisma.merchant.findUnique({
    where: { email: 'demo@paypilot.com' },
    select: {
      orders: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, provider: true, providerPaymentId: true, amount: true, currency: true, status: true, createdAt: true },
          },
        },
      },
    },
  })
  return merchant?.orders.flatMap((order) => order.payments.map((payment) => ({ order, payment }))) ?? []
}

export default async function PaymentsPage() {
  const payments = await getPayments()
  return <DashboardLayout><div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Settlement ledger</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Payments</h1><p className="mt-2 text-slate-600">Read-only payment activity for the demo merchant.</p></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{['Payment','Order','Amount','Status','Provider','Recorded'].map((heading) => <th key={heading} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{payments.length === 0 ? <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-600">No payment records yet.</td></tr> : payments.map(({ order, payment }) => <tr key={payment.id}><td className="px-6 py-4 text-sm font-medium text-slate-900">#{payment.providerPaymentId ?? payment.id.slice(0, 8)}</td><td className="px-6 py-4 text-sm text-slate-700">#{order.id.slice(0, 8)}</td><td className="px-6 py-4 text-sm font-semibold text-slate-950">{payment.currency === 'INR' ? '₹' : '$'}{Number(payment.amount).toLocaleString()}</td><td className="px-6 py-4 text-sm font-semibold text-cyan-700">{payment.status}</td><td className="px-6 py-4 text-sm text-slate-700">{payment.provider}</td><td className="px-6 py-4 text-sm text-slate-600">{new Date(payment.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div></div></div></DashboardLayout>
}
