import { getCurrentBuyer, publicBuyer } from '@/services/buyerAuth'

export const runtime = 'nodejs'

export async function GET() {
  const buyer = await getCurrentBuyer()
  return buyer ? Response.json({ buyer: publicBuyer(buyer) }) : Response.json({ buyer: null }, { status: 401 })
}
