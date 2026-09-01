import { runCommerceAgent } from '@/services/commerceAgent'
import { validateAgentRequest } from '@/services/agentRequest'
import { agentSessionStore } from '@/services/agentSession'
import { auditAgentAction } from '@/services/agentTools'
import { cookies } from 'next/headers'

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
    const body = validateAgentRequest(await request.json())
    if (!body) {
      await auditAgentAction('Blocked invalid agent request', {})
      return Response.json({ error: 'Invalid assistant request.' }, { status: 400 })
    }
    const sessionId = await getSessionId()
    agentSessionStore.updateCart(sessionId, body.cart)
    await auditAgentAction('Customer agent conversation requested', { messageCount: body.messages.length, cartItemCount: body.cart.length })
    const result = await runCommerceAgent(body.messages, { cart: body.cart, confirmed: false, checkoutKey: agentSessionStore.checkoutKey(sessionId) })
    return Response.json(result)
  } catch {
    console.error('Gemini assistant request failed')
    return Response.json({ error: 'The shopping assistant is temporarily unavailable. Please try again.' }, { status: 503 })
  }
}
