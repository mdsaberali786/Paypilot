import { runCommerceAgent } from '@/services/commerceAgent'
import { validateAgentRequest } from '@/services/agentRequest'
import { agentSessionStore } from '@/services/agentSession'
import { auditAgentAction } from '@/services/agentTools'
import { resolveAuditMerchantId } from '@/services/auditService'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

function isSensitiveDiagnosticKey(key: string) {
  const normalized = key.toLowerCase()
  return [
    'gemini_api_key',
    'database_url',
    'razorpay_key_secret',
    'authorization',
    'cookie',
    'set-cookie',
    'api_key',
    'secret',
    'token',
    'password',
  ].some((sensitive) => normalized.includes(sensitive))
}

function sanitizeDiagnosticValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (
      normalized.includes('gemini_api_key') ||
      normalized.includes('database_url') ||
      normalized.includes('razorpay_key_secret') ||
      normalized.includes('authorization') ||
      normalized.includes('cookie') ||
      normalized.includes('secret') ||
      normalized.includes('token')
    ) {
      return '[REDACTED]'
    }
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticValue(item, seen))
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]'
    }
    seen.add(value)

    const sanitized: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveDiagnosticKey(key)) {
        continue
      }
      sanitized[key] = sanitizeDiagnosticValue(nestedValue, seen)
    }
    return sanitized
  }

  return value
}

function getSafeErrorDetails(error: unknown) {
  const details: {
    name?: string
    message?: string
    status?: number | string
    provider?: unknown
  } = {}

  if (!error || typeof error !== 'object') {
    return details
  }

  const err = error as Record<string, unknown>

  if (typeof err.name === 'string') {
    details.name = err.name
  }

  if (typeof err.message === 'string') {
    details.message = err.message
  }

  const status = err.status ?? err.statusCode
  if (typeof status === 'number' || typeof status === 'string') {
    details.status = status
  }

  const providerPayload = err.response ?? err.body ?? err.cause
  if (providerPayload !== undefined) {
    details.provider = sanitizeDiagnosticValue(providerPayload)
  }

  return details
}

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
    const merchantId = await resolveAuditMerchantId({ productIds: body.cart.map((item) => item.productId) })
    await auditAgentAction('Customer agent conversation requested', { event: 'conversation', messageCount: body.messages.length, cartItemCount: body.cart.length, productIds: body.cart.map((item) => item.productId) }, undefined, merchantId)
    const result = await runCommerceAgent(body.messages, { cart: body.cart, confirmed: false, checkoutKey: agentSessionStore.checkoutKey(sessionId), merchantId })
    return Response.json(result)
  } catch (error: unknown) {
    console.error('Gemini assistant request failed', getSafeErrorDetails(error))
    return Response.json({ error: 'The shopping assistant is temporarily unavailable. Please try again.' }, { status: 503 })
  }
}
