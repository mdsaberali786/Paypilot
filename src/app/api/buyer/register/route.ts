import { BuyerAuthError, createBuyerSession, publicBuyer, registerBuyer } from '@/services/buyerAuth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; email?: unknown; password?: unknown }
    if (typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return Response.json({ error: 'Name, email, and password are required.' }, { status: 400 })
    }
    const buyer = await registerBuyer(body.name, body.email, body.password)
    await createBuyerSession(buyer.id)
    return Response.json({ buyer: publicBuyer(buyer) }, { status: 201 })
  } catch (error) {
    if (error instanceof BuyerAuthError) return Response.json({ error: error.message }, { status: 400 })
    console.error('Buyer registration failed', error)
    return Response.json({ error: 'Unable to create your account.' }, { status: 500 })
  }
}
