import { logoutBuyer } from '@/services/buyerAuth'

export const runtime = 'nodejs'

export async function POST() {
  await logoutBuyer()
  return Response.json({ ok: true })
}
