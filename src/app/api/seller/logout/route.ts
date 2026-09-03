import { logoutSeller } from '@/services/sellerAuth'
export const runtime = 'nodejs'
export async function POST() { await logoutSeller(); return Response.json({ ok: true }) }
