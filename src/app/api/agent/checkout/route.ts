import { cookies } from 'next/headers'
import { validateAgentRequest } from '@/services/agentRequest'
import { agentSessionStore } from '@/services/agentSession'
import { auditAgentAction, executeAgentTool } from '@/services/agentTools'
import { resolveAuditMerchantId } from '@/services/auditService'
import { getCurrentBuyer } from '@/services/buyerAuth'

export const runtime = 'nodejs'

async function getSessionId() {
  const cookieStore = await cookies()
  let sessionId = cookieStore.get('paypilot-agent-session')?.value
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    cookieStore.set('paypilot-agent-session', sessionId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 4 })
  }
  return sessionId
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: unknown; cart?: unknown }
    const validated = validateAgentRequest({ messages: [], cart: body.cart })
    if (!validated || (body.action !== 'review' && body.action !== 'confirm')) return Response.json({ error: 'Invalid checkout request.' }, { status: 400 })

    const sessionId = await getSessionId()
    const fingerprint = agentSessionStore.updateCart(sessionId, validated.cart)
    const merchantId = await resolveAuditMerchantId({ productIds: validated.cart.map((item) => item.productId) })
    const context = { cart: validated.cart, confirmed: false, checkoutKey: agentSessionStore.checkoutKey(sessionId), merchantId }

    if (body.action === 'review') {
      const summary = await executeAgentTool('calculate_cart', {}, context)
      if (summary.status === 'success') {
        agentSessionStore.markReviewed(sessionId, fingerprint)
        await auditAgentAction('Customer reviewed agent checkout summary', { event: 'cart_review', itemCount: validated.cart.length, productIds: validated.cart.map((item) => item.productId) }, undefined, merchantId)
      } else {
        await auditAgentAction('Blocked agent checkout review', { reason: summary.message, productIds: validated.cart.map((item) => item.productId) }, undefined, merchantId)
      }
      return Response.json(summary, { status: summary.status === 'success' ? 200 : 409 })
    }

    if (!agentSessionStore.canConfirm(sessionId, fingerprint)) {
      await auditAgentAction('Blocked agent order confirmation', { reason: 'missing or stale checkout review', productIds: validated.cart.map((item) => item.productId) }, undefined, merchantId)
      return Response.json({ error: 'Review the current order before confirming it. Changes to your cart require a new review.' }, { status: 409 })
    }
    const buyer = await getCurrentBuyer()
    if (!buyer) return Response.json({ error: 'Please sign in before placing an order.' }, { status: 401 })
    await auditAgentAction('Customer explicitly confirmed agent checkout', { itemCount: validated.cart.length, productIds: validated.cart.map((item) => item.productId) }, undefined, merchantId)
    const order = await executeAgentTool('create_order', {}, { ...context, confirmed: true, buyerId: buyer.id })
    agentSessionStore.clearReview(sessionId)
    return Response.json(order, { status: order.status === 'success' ? 201 : 409 })
  } catch (error) {
    await auditAgentAction('Agent checkout failed', { error: error instanceof Error ? error.message : 'unknown' })
    return Response.json({ error: 'Unable to prepare your order. Please try again.' }, { status: 500 })
  }
}
