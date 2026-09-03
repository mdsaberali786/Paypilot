import { SellerAuthError, authenticateSeller, createSellerSession, publicSeller } from '@/services/sellerAuth'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown }
    if (typeof body.email !== 'string' || typeof body.password !== 'string') return Response.json({ error: 'Invalid email or password.' }, { status: 400 })
    const seller = await authenticateSeller(body.email, body.password); await createSellerSession(seller.id)
    return Response.json({ seller: publicSeller(seller) })
  } catch (error) {
    if (error instanceof SellerAuthError) return Response.json({ error: error.message }, { status: 401 })
    console.error('Seller login failed', error); return Response.json({ error: 'Unable to sign you in.' }, { status: 500 })
  }
}
