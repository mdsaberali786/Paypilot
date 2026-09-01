import { createHmac, timingSafeEqual } from 'crypto'
import { Prisma, type AuditAction } from '@prisma/client'
import Razorpay from 'razorpay'
import { prisma } from '@/lib/prisma'

type RazorpayOrderClient = { orders: { create: (input: { amount: number; currency: string; receipt: string }) => Promise<{ id: string; amount: number; currency: string }> } }
type RecoveryAuditAction = AuditAction

export class PaymentValidationError extends Error {}

function razorpayClient(): RazorpayOrderClient {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new PaymentValidationError('Payment service is not configured.')
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) as unknown as RazorpayOrderClient
}

export function rupeesToPaise(amount: Prisma.Decimal | number | string) {
  const paise = new Prisma.Decimal(amount).mul(100)
  if (!paise.isInteger() || paise.lessThanOrEqualTo(0) || paise.greaterThan(Number.MAX_SAFE_INTEGER)) throw new PaymentValidationError('Invalid payment amount.')
  return paise.toNumber()
}

export function verifyRazorpaySignature(providerOrderId: string, providerPaymentId: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(`${providerOrderId}|${providerPaymentId}`).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const signatureBuffer = Buffer.from(signature, 'utf8')
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer)
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const signatureBuffer = Buffer.from(signature, 'utf8')
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer)
}

export function isDuplicateWebhookEvent(eventId: string | null, duplicateEventId: string | null) {
  return Boolean(eventId && duplicateEventId && eventId === duplicateEventId)
}

export function canRetryRazorpayPayment(orderStatus: string, paymentStatus?: string | null) {
  if (orderStatus === 'CONFIRMED' || paymentStatus === 'COMPLETED') {
    return { allowed: false, reason: 'This order has already been paid.' }
  }
  if (orderStatus === 'CANCELLED' || orderStatus === 'REFUNDED') {
    return { allowed: false, reason: 'This order is not available for payment.' }
  }
  if (paymentStatus === 'PENDING' || paymentStatus === 'PROCESSING') {
    return { allowed: false, reason: 'A payment is already in progress for this order.' }
  }
  if (!paymentStatus || paymentStatus === 'FAILED') {
    return { allowed: true, reason: 'Payment retry is allowed.' }
  }
  return { allowed: false, reason: 'This order cannot be retried at the moment.' }
}

async function audit(order: { id: string; merchantId: string }, action: RecoveryAuditAction, reason: string, metadata: object) {
  await prisma.auditLog.create({ data: { merchantId: order.merchantId, orderId: order.id, action, reason, metadata } })
}

async function logDuplicateWebhookIgnored(rawBody: string, eventId: string) {
  try {
    const payload = JSON.parse(rawBody) as { payload?: { payment?: { entity?: { order_id?: string } } } }
    const providerOrderId = payload.payload?.payment?.entity?.order_id
    if (!providerOrderId) return
    const payment = await prisma.payment.findUnique({ where: { providerOrderId }, include: { order: true } })
    if (!payment) return
    await audit(payment.order, 'WEBHOOK_REPLAY_IGNORED', 'Duplicate Razorpay webhook event ignored', {
      paypilotOrderId: payment.orderId,
      razorpayOrderId: providerOrderId,
      eventId,
      duplicate: true,
    })
  } catch {
    // Ignore duplicate-event audit failures so the webhook can remain idempotent without exposing internal details.
  }
}

export async function createRazorpayOrder(paypilotOrderId: string) {
  const order = await prisma.order.findUnique({ where: { id: paypilotOrderId }, include: { payments: true } })
  if (!order) throw new PaymentValidationError('Order not found.')
  if (order.currency !== 'INR') throw new PaymentValidationError('Only INR payments are supported.')
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') throw new PaymentValidationError('This order is not available for payment.')

  const existing = order.payments.find((payment) => payment.provider === 'razorpay' && payment.providerOrderId && ['PENDING', 'PROCESSING'].includes(payment.status))
  const amount = rupeesToPaise(order.totalAmount)
  if (existing?.providerOrderId) return { paypilotOrderId: order.id, providerOrderId: existing.providerOrderId, amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID! }

  const providerOrder = await razorpayClient().orders.create({ amount, currency: 'INR', receipt: order.id })
  try {
    await prisma.payment.create({ data: { orderId: order.id, provider: 'razorpay', providerOrderId: providerOrder.id, amount: order.totalAmount, currency: order.currency, status: 'PENDING' } })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
  }
  await audit(order, 'PAYMENT_INITIATED', 'Razorpay Test Mode order created', { paypilotOrderId: order.id, razorpayOrderId: providerOrder.id, amount, currency: order.currency })
  return { paypilotOrderId: order.id, providerOrderId: providerOrder.id, amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID! }
}

export async function retryRazorpayPayment(paypilotOrderId: string) {
  const order = await prisma.order.findUnique({ where: { id: paypilotOrderId }, include: { payments: true } })
  if (!order) throw new PaymentValidationError('Order not found.')
  if (order.currency !== 'INR') throw new PaymentValidationError('Only INR payments are supported.')
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') throw new PaymentValidationError('This order is not available for payment.')

  const latestPayment = order.payments.find((payment) => payment.provider === 'razorpay')
  const retryDecision = canRetryRazorpayPayment(order.status, latestPayment?.status)
  if (!retryDecision.allowed) {
    throw new PaymentValidationError(retryDecision.reason)
  }

  const result = await createRazorpayOrder(order.id)
  await audit(order, 'PAYMENT_RETRY_INITIATED', 'Razorpay payment retry initiated', {
    paypilotOrderId: order.id,
    razorpayOrderId: result.providerOrderId,
    amount: result.amount,
    currency: result.currency,
    retryAttempt: true,
  })
  return result
}

async function markCaptured(providerOrderId: string, providerPaymentId: string, source: 'callback' | 'webhook') {
  const payment = await prisma.payment.findUnique({ where: { providerOrderId }, include: { order: true } })
  if (!payment || payment.provider !== 'razorpay') throw new PaymentValidationError('Payment not found.')
  if (payment.status === 'COMPLETED') return { order: payment.order, payment, duplicate: true }
  const wasFailedRecovery = payment.status === 'FAILED'
  const result = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED', providerPaymentId, failureReason: null } })
    const updatedOrder = await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED' } })
    if (wasFailedRecovery) {
      await tx.auditLog.create({ data: { merchantId: payment.order.merchantId, orderId: payment.orderId, action: 'PAYMENT_RECOVERY_SUCCESS', reason: 'Razorpay payment recovery succeeded', metadata: { paypilotOrderId: payment.orderId, razorpayOrderId: providerOrderId, razorpayPaymentId: providerPaymentId, source } } })
    }
    await tx.auditLog.create({ data: { merchantId: payment.order.merchantId, orderId: payment.orderId, action: 'PAYMENT_COMPLETED', reason: 'Razorpay payment verified', metadata: { paypilotOrderId: payment.orderId, razorpayOrderId: providerOrderId, razorpayPaymentId: providerPaymentId, source } } })
    return { order: updatedOrder, payment: updatedPayment, duplicate: false }
  })
  return result
}

export async function verifyRazorpayPayment(input: { paypilotOrderId: string; providerOrderId: string; providerPaymentId: string; signature: string }) {
  if (!process.env.RAZORPAY_KEY_SECRET) throw new PaymentValidationError('Payment service is not configured.')
  const payment = await prisma.payment.findUnique({ where: { providerOrderId: input.providerOrderId }, include: { order: true } })
  if (!payment || payment.orderId !== input.paypilotOrderId || payment.provider !== 'razorpay') throw new PaymentValidationError('Payment does not match this order.')
  if (payment.status === 'COMPLETED') return { order: payment.order, payment, duplicate: true }
  if (!verifyRazorpaySignature(payment.providerOrderId!, input.providerPaymentId, input.signature, process.env.RAZORPAY_KEY_SECRET)) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Payment signature verification failed' } })
    await audit(payment.order, 'PAYMENT_VERIFICATION_FAILED', 'Razorpay payment signature verification failed', { paypilotOrderId: payment.orderId, razorpayOrderId: input.providerOrderId, razorpayPaymentId: input.providerPaymentId })
    await audit(payment.order, 'PAYMENT_RECOVERY_FAILED', 'Payment verification failed; customer retry required', { paypilotOrderId: payment.orderId, razorpayOrderId: input.providerOrderId, razorpayPaymentId: input.providerPaymentId })
    throw new PaymentValidationError('We could not verify this payment. Please try again.')
  }
  return markCaptured(input.providerOrderId, input.providerPaymentId, 'callback')
}

export async function markRazorpayPaymentFailed(providerOrderId: string, reason: string, eventType?: string) {
  const payment = await prisma.payment.findUnique({ where: { providerOrderId }, include: { order: true } })
  if (!payment || payment.status === 'COMPLETED') return false
  await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: reason } })
  await audit(payment.order, 'PAYMENT_FAILED', 'Razorpay payment failed', { paypilotOrderId: payment.orderId, razorpayOrderId: providerOrderId, eventType })
  return true
}

export async function getPaymentForOrder(orderId: string) {
  return prisma.payment.findFirst({ where: { orderId, provider: 'razorpay' }, orderBy: { createdAt: 'desc' } })
}

export async function handleRazorpayWebhook(rawBody: string, signature: string | null, eventId: string | null) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !signature || !eventId) throw new PaymentValidationError('Invalid webhook request.')
  if (!verifyRazorpayWebhookSignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET)) throw new PaymentValidationError('Invalid webhook signature.')
  try {
    await prisma.webhookEvent.create({ data: { provider: 'razorpay', eventId } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      await logDuplicateWebhookIgnored(rawBody, eventId)
      return { ignored: true, duplicate: true }
    }
    throw error
  }
  const payload = JSON.parse(rawBody) as { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string } } } }
  const providerOrderId = payload.payload?.payment?.entity?.order_id
  const providerPaymentId = payload.payload?.payment?.entity?.id
  if (!providerOrderId) return { ignored: true }
  if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
    if (providerPaymentId) await markCaptured(providerOrderId, providerPaymentId, 'webhook')
  } else if (payload.event === 'payment.failed') {
    await markRazorpayPaymentFailed(providerOrderId, 'Razorpay reported a failed payment', payload.event)
  }
  await prisma.webhookEvent.update({ where: { eventId }, data: { processedAt: new Date() } })
  return { ignored: false }
}
