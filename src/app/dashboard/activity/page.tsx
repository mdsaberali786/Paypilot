import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { requireSeller } from '@/services/sellerAuth'
import { getAuditLogsByMerchant } from '@/services/auditService'

export const dynamic = 'force-dynamic'

async function getAuditLogs() {
  const seller = await requireSeller()
  return getAuditLogsByMerchant(seller.id)
}

const actionColors: Record<string, string> = {
  ORDER_CREATED: 'bg-blue-100 text-blue-800',
  ORDER_UPDATED: 'bg-indigo-100 text-indigo-800',
  PAYMENT_INITIATED: 'bg-yellow-100 text-yellow-800',
  PAYMENT_COMPLETED: 'bg-green-100 text-green-800',
  PAYMENT_FAILED: 'bg-red-100 text-red-800',
  PAYMENT_REFUNDED: 'bg-orange-100 text-orange-800',
  PRODUCT_RECOMMENDED: 'bg-purple-100 text-purple-800',
  AGENT_DECISION: 'bg-pink-100 text-pink-800',
  SYSTEM_ERROR: 'bg-red-100 text-red-800',
}

const actionLabels: Record<string, string> = {
  ORDER_CREATED: 'Order Created',
  ORDER_UPDATED: 'Order Updated',
  PAYMENT_INITIATED: 'Payment Initiated',
  PAYMENT_COMPLETED: 'Payment Completed',
  PAYMENT_FAILED: 'Payment Failed',
  PAYMENT_REFUNDED: 'Payment Refunded',
  PRODUCT_RECOMMENDED: 'Product Recommended',
  AGENT_DECISION: 'AI Agent Decision',
  SYSTEM_ERROR: 'System Error',
}

export default async function ActivityPage() {
  const auditLogs = await getAuditLogs()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
          <p className="mt-2 text-gray-600">Track AI agent decisions and system events</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No activity logs found yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${actionColors[log.action]}`}>
                          {actionLabels[log.action]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.orderId ? (
                          <span className="font-medium">#{log.orderId.slice(0, 8)}</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {log.reason || <span className="text-gray-500">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-blue-600 hover:text-blue-700">View details</summary>
                            <pre className="mt-2 rounded bg-gray-50 p-2 text-xs">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
