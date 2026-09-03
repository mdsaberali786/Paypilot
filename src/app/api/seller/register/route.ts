import { SellerAuthError, createSellerSession, publicSeller, registerSeller } from '@/services/sellerAuth'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; email?: unknown; password?: unknown }
    if (typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.password !== 'string') return Response.json({ error: 'Name, email, and password are required.' }, { status: 400 })
    const seller = await registerSeller(body.name, body.email, body.password); await createSellerSession(seller.id)
    return Response.json({ seller: publicSeller(seller) }, { status: 201 })
  } catch (error) {
    if (error instanceof SellerAuthError) return Response.json({ error: error.message }, { status: 400 })
    console.error('Seller registration failed', error); return Response.json({ error: 'Unable to create your account.' }, { status: 500 })
  }
}
