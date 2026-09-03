import { getCurrentSeller } from '@/services/sellerAuth'
import { getMerchantGrowthAnalytics } from '@/services/growthAnalytics'
import { generateGrowthInsight } from '@/services/growthInsight'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const insightRequests = new Map<string, number>()
const INSIGHT_COOLDOWN_MS = 15_000

export function tryAcquireInsightCooldown(sellerId: string, now = Date.now()) {
  const lastRequest = insightRequests.get(sellerId) ?? 0
  if (now - lastRequest < INSIGHT_COOLDOWN_MS) return false
  insightRequests.set(sellerId, now)
  return true
}

function readPeriod(request: Request) {
  const value = new URL(request.url).searchParams.get('days')
  const days = value ? Number(value) : 30
  return Number.isInteger(days) && days > 0 && days <= 365 ? days : 30
}

export async function GET(request: Request) {
  const seller = await getCurrentSeller()
  if (!seller) return Response.json({ error: 'Seller authentication required.' }, { status: 401 })
  try {
    return Response.json(await getMerchantGrowthAnalytics(seller.id, readPeriod(request)))
  } catch (error) {
    console.error('Growth analytics failed', error)
    return Response.json({ error: 'Unable to load growth analytics right now.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const seller = await getCurrentSeller()
  if (!seller) return Response.json({ error: 'Seller authentication required.' }, { status: 401 })
  if (!tryAcquireInsightCooldown(seller.id)) return Response.json({ error: 'Please wait before generating another insight.' }, { status: 429 })
  try {
    const analytics = await getMerchantGrowthAnalytics(seller.id, readPeriod(request))
    const result = await generateGrowthInsight(analytics)
    return Response.json({
      ...result,
      generatedAt: new Date().toISOString(),
      periodDays: analytics.periodDays,
      supportingMetrics: { revenue: analytics.revenue, orders: analytics.orders, paidOrders: analytics.paidOrders, conversionRate: analytics.conversionRate },
    })
  } catch (error) {
    console.error('Growth insight failed', error)
    return Response.json({ error: 'Unable to generate a growth insight right now.' }, { status: 500 })
  }
}
