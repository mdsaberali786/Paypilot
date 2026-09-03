import { GoogleGenAI, type Interactions } from '@google/genai'
import type { GrowthAnalytics } from './growthAnalytics'

const MAX_INSIGHT_LENGTH = 2_000

export function sanitizeGrowthInsight(value: unknown) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/(?:api[_ -]?key|secret|password|authorization|cookie|token)\s*[:=]\s*\S+/gi, '[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .trim()
    .slice(0, MAX_INSIGHT_LENGTH)
}

export function deterministicGrowthInsight(analytics: Pick<GrowthAnalytics, 'revenue' | 'orders' | 'paidOrders' | 'conversionRate' | 'failedPayments' | 'productPerformance'>) {
  const topProduct = analytics.productPerformance.find((product) => product.unitsSold > 0)
  if (analytics.orders === 0) return 'No orders were recorded in this period. Add a focused promotion and use the AI assistant to guide shoppers to your best products.'
  if (analytics.paidOrders === 0) return 'Not enough completed activity exists for a reliable growth recommendation yet. Keep the catalog available and check back after the next paid order.'
  const conversionAdvice = analytics.conversionRate < 30
    ? 'Focus on checkout friction and follow up with shoppers who did not complete payment.'
    : 'Conversion is healthy; test a small increase in average order value with bundles or complementary products.'
  const productAdvice = topProduct
    ? `Your strongest product is ${topProduct.name} with ${topProduct.unitsSold} unit${topProduct.unitsSold === 1 ? '' : 's'} sold.`
    : 'No paid product sales were recorded yet.'
  return `${productAdvice} Revenue is ₹${Math.round(analytics.revenue).toLocaleString()} from ${analytics.paidOrders} paid order${analytics.paidOrders === 1 ? '' : 's'} (${analytics.conversionRate}% conversion). ${conversionAdvice}${analytics.failedPayments > 0 ? ` There were ${analytics.failedPayments} failed payment${analytics.failedPayments === 1 ? '' : 's'} to recover.` : ''}`
}

type GeminiClient = { interactions: { create: (request: Record<string, unknown>) => Promise<Partial<Interactions.Interaction> & { output_text?: string; steps?: unknown[] }> } }

export async function generateGrowthInsight(analytics: GrowthAnalytics, client?: GeminiClient) {
  const fallback = deterministicGrowthInsight(analytics)
  if (!process.env.GEMINI_API_KEY && !client) return { insight: fallback, source: 'fallback' as const }
  try {
    const gemini = client ?? (new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }) as unknown as GeminiClient)
    const response = await gemini.interactions.create({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      input: `Give one concise actionable growth insight using only these aggregate merchant metrics (no personal data): ${JSON.stringify({
        revenue: analytics.revenue,
        orders: analytics.orders,
        paidOrders: analytics.paidOrders,
        conversionRate: analytics.conversionRate,
        failedPayments: analytics.failedPayments,
        topProducts: analytics.productPerformance.slice(0, 5).map((product) => ({ name: sanitizeGrowthInsight(product.name).slice(0, 100), unitsSold: product.unitsSold, revenue: product.revenue })),
      })}`,
    })
    const text = typeof response.output_text === 'string'
      ? response.output_text
      : Array.isArray(response.steps)
        ? response.steps.flatMap((step) => {
          const content = (step as { content?: unknown }).content
          return Array.isArray(content) ? content.filter((part): part is { text: string } => Boolean(part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string')) : []
        }).map((part) => part.text).join('')
        : ''
    const insight = text.length > MAX_INSIGHT_LENGTH ? '' : sanitizeGrowthInsight(text)
    return insight ? { insight, source: 'gemini' as const } : { insight: fallback, source: 'fallback' as const }
  } catch {
    return { insight: fallback, source: 'fallback' as const }
  }
}
