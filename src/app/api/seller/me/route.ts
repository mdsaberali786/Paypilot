import { getCurrentSeller, publicSeller } from '@/services/sellerAuth'
export const runtime = 'nodejs'
export async function GET() { const seller = await getCurrentSeller(); return seller ? Response.json({ seller: publicSeller(seller) }) : Response.json({ seller: null }, { status: 401 }) }
