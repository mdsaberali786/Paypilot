import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/dashboard/DashboardLayout'

export const dynamic = 'force-dynamic'

async function getActivity() {
  const merchant = await prisma.merchant.findUnique({
    where: { email: 'demo@paypilot.com' },
    select: { auditLogs: { orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, action: true, reason: true, metadata: true, orderId: true, createdAt: true } } },
  })
  return merchant?.auditLogs ?? []
}

export default async function AiActivityPage() {
  const logs = await getActivity()
  return <DashboardLayout><div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Decision stream</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">AI Activity</h1><p className="mt-2 text-slate-600">Real assistant and commerce events for the demo merchant.</p></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{['Timestamp','Action','Result','Order','Context'].map((heading) => <th key={heading} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{logs.length === 0 ? <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-600">No AI activity recorded yet.</td></tr> : logs.map((log) => <tr key={log.id}><td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{new Date(log.createdAt).toLocaleString()}</td><td className="px-6 py-4 text-sm font-semibold text-slate-900">{log.action.replaceAll('_', ' ')}</td><td className="max-w-sm px-6 py-4 text-sm text-slate-700">{log.reason ?? 'Completed'}</td><td className="px-6 py-4 text-sm font-medium text-cyan-700">{log.orderId ? `#${log.orderId.slice(0, 8)}` : '—'}</td><td className="max-w-md px-6 py-4 text-xs text-slate-600">{log.metadata ? JSON.stringify(log.metadata) : '—'}</td></tr>)}</tbody></table></div></div></div></DashboardLayout>
}
