import { BuyerAuthError, authenticateBuyer, createBuyerSession, publicBuyer } from '@/services/buyerAuth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown }
    if (typeof body.email !== 'string' || typeof body.password !== 'string') return Response.json({ error: 'Invalid email or password.' }, { status: 400 })
    const buyer = await authenticateBuyer(body.email, body.password)
    await createBuyerSession(buyer.id)
    return Response.json({ buyer: publicBuyer(buyer) })
  } catch (error) {
    if (error instanceof BuyerAuthError) return Response.json({ error: error.message }, { status: 401 })
    console.error('Buyer login failed', error)
    return Response.json({ error: 'Unable to sign you in.' }, { status: 500 })
  }
}
