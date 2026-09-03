import { requireSeller } from '@/services/sellerAuth'
export default async function DashboardRouteLayout({ children }: { children: React.ReactNode }) {
  await requireSeller()
  return children
}
