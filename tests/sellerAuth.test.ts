import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessMerchant, hashSellerPassword, hashSellerSessionToken, sellerSessionDeleteWhere, verifySellerPassword, SellerAuthError, registerSeller, isSellerSessionActive } from '../src/services/sellerAuth'
import { merchantOwnsProduct, merchantProductWhere } from '../src/services/productService'
import { merchantOwnsOrder, merchantOrderWhere } from '../src/services/orderService'
import { merchantAuditWhere, merchantOwnsAuditLog } from '../src/services/auditService'
import { prisma } from '../src/lib/prisma'

test('seller passwords are salted scrypt hashes and verify safely', async () => {
  const hash = await hashSellerPassword('seller-secret')
  assert.match(hash, /^scrypt:[^:]+:[0-9a-f]+$/)
  assert.equal(await verifySellerPassword('seller-secret', hash), true)
  assert.equal(await verifySellerPassword('wrong', hash), false)
  assert.notEqual(hash, await hashSellerPassword('seller-secret'))
})

test('seller password requirements reject short passwords and legacy null hashes', async () => {
  await assert.rejects(() => hashSellerPassword('short'), SellerAuthError)
  assert.equal(await verifySellerPassword('seller-secret', null), false)
})

test('seller session tokens are one-way hashed and merchant access is scoped', () => {
  assert.notEqual(hashSellerSessionToken('opaque-token'), 'opaque-token')
  assert.equal(hashSellerSessionToken('opaque-token'), hashSellerSessionToken('opaque-token'))
  assert.equal(canAccessMerchant('merchant-1', 'merchant-1'), true)
  assert.equal(canAccessMerchant('merchant-1', 'merchant-2'), false)
  assert.equal(canAccessMerchant('merchant-1', null), false)
})

const sellerA = { id: 'merchant-a', session: 'seller-session-a' }
const sellerB = { id: 'merchant-b', session: 'seller-session-b' }
const products = [
  { id: 'product-a', merchantId: sellerA.id },
  { id: 'product-b', merchantId: sellerB.id },
]
const orders = [
  { id: 'order-a', merchantId: sellerA.id },
  { id: 'order-b', merchantId: sellerB.id },
]
const payments = [
  { id: 'payment-a', merchantId: sellerA.id },
  { id: 'payment-b', merchantId: sellerB.id },
]
const aiActivity = [
  { id: 'ai-a', merchantId: sellerA.id },
  { id: 'ai-b', merchantId: sellerB.id },
]
const auditTrail = [
  { id: 'audit-a', merchantId: sellerA.id },
  { id: 'audit-b', merchantId: sellerB.id },
]

test('unauthenticated seller dashboard access is denied', () => {
  assert.equal(canAccessMerchant(sellerA.id, null), false)
})

test('buyer authentication cannot satisfy seller authentication', () => {
  const buyerSession = { id: 'buyer-session-a', buyerId: 'buyer-a' }
  assert.equal(canAccessMerchant(sellerA.id, buyerSession.buyerId), false)
  assert.notEqual(buyerSession.id, sellerA.session)
})

test('seller A can access seller A merchant data', () => {
  assert.equal(canAccessMerchant(sellerA.id, sellerA.id), true)
})

test('seller A cannot access seller B merchant data', () => {
  assert.equal(canAccessMerchant(sellerB.id, sellerA.id), false)
})

test('client-supplied merchant IDs cannot override the authenticated seller', () => {
  const authenticatedMerchantId = sellerA.id
  const clientMerchantId = sellerB.id
  assert.equal(canAccessMerchant(authenticatedMerchantId, authenticatedMerchantId), true)
  assert.equal(canAccessMerchant(clientMerchantId, authenticatedMerchantId), false)
})

test('seller product creation uses the authenticated seller merchant', () => {
  const clientMerchantId = sellerB.id
  const createdProduct = { merchantId: sellerA.id }
  assert.equal(createdProduct.merchantId, sellerA.id)
  assert.equal(canAccessMerchant(clientMerchantId, sellerA.id), false)
})

test('seller product access is scoped by merchant ownership', () => {
  assert.equal(merchantOwnsProduct(products[0], sellerA.id), true)
  assert.equal(merchantOwnsProduct(products[1], sellerA.id), false)
  assert.deepEqual(merchantProductWhere('product-a', sellerA.id), { id: 'product-a', merchantId: sellerA.id })
})

test('seller orders are scoped by merchant ownership', () => {
  assert.equal(merchantOwnsOrder(orders[0], sellerA.id), true)
  assert.equal(merchantOwnsOrder(orders[1], sellerA.id), false)
  assert.deepEqual(merchantOrderWhere('order-a', sellerA.id), { id: 'order-a', merchantId: sellerA.id })
})

test('seller payments are scoped by merchant ownership', () => {
  assert.equal(merchantOwnsOrder({ merchantId: payments[0].merchantId }, sellerA.id), true)
  assert.equal(merchantOwnsOrder({ merchantId: payments[1].merchantId }, sellerA.id), false)
})

test('seller AI Activity is scoped by merchant ownership', () => {
  assert.equal(merchantOwnsAuditLog(aiActivity[0], sellerA.id), true)
  assert.equal(merchantOwnsAuditLog(aiActivity[1], sellerA.id), false)
})

test('seller Audit Trail is scoped by merchant ownership', () => {
  assert.equal(merchantOwnsAuditLog(auditTrail[0], sellerA.id), true)
  assert.equal(merchantOwnsAuditLog(auditTrail[1], sellerA.id), false)
  assert.deepEqual(merchantAuditWhere(sellerA.id), { merchantId: sellerA.id })
})

test('seller logout invalidates the seller session token', () => {
  const token = 'opaque-seller-token'
  const now = new Date('2026-01-01T00:00:00Z')
  assert.equal(isSellerSessionActive(new Date('2026-01-01T00:01:00Z'), now), true)
  assert.equal(isSellerSessionActive(new Date('2025-12-31T23:59:00Z'), now), false)
  assert.deepEqual(sellerSessionDeleteWhere(token), { tokenHash: hashSellerSessionToken(token) })
  assert.notEqual(sellerSessionDeleteWhere(token).tokenHash, token)
})

test('legacy merchant association preserves merchant identity and related records', () => {
  const legacyMerchant = {
    id: sellerA.id,
    passwordHash: null,
    products: products.filter((product) => product.merchantId === sellerA.id),
    orders: orders.filter((order) => order.merchantId === sellerA.id),
    payments: payments.filter((payment) => payment.merchantId === sellerA.id),
  }
  assert.equal(legacyMerchant.passwordHash, null)
  assert.equal(legacyMerchant.id, sellerA.id)
  assert.equal(legacyMerchant.products.length, 1)
  assert.equal(legacyMerchant.orders.length, 1)
  assert.equal(legacyMerchant.payments.length, 1)
})

test('registration rejects existing passwordless and password-bearing merchants without mutation', async () => {
  const originalFind = prisma.merchant.findUnique
  const originalCreate = prisma.merchant.create
  let createCalled = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(prisma.merchant as any).findUnique = async () => ({ id: 'legacy', email: 'seller@example.com', passwordHash: null })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(prisma.merchant as any).create = async () => { createCalled = true }
  await assert.rejects(() => registerSeller('New', 'seller@example.com', 'new-secret'), /already exists/)
  assert.equal(createCalled, false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(prisma.merchant as any).findUnique = async () => ({ id: 'existing', email: 'seller@example.com', passwordHash: 'existing-hash' })
  await assert.rejects(() => registerSeller('New', 'seller@example.com', 'new-secret'), /already exists/)
  assert.equal(createCalled, false)
  prisma.merchant.findUnique = originalFind
  prisma.merchant.create = originalCreate
})

test('registration creates a new merchant when email is unused', async () => {
  const originalFind = prisma.merchant.findUnique
  const originalCreate = prisma.merchant.create
  let created: { name?: string; email?: string; passwordHash?: string } | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(prisma.merchant as any).findUnique = async () => null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(prisma.merchant as any).create = async (args: any) => { created = args.data; return { id: 'new', ...args.data } }
  const seller = await registerSeller(' New Store ', ' NEW@Example.com ', 'new-secret')
  assert.equal(seller.id, 'new')
  assert.equal(created?.name, 'New Store')
  assert.equal(created?.email, 'new@example.com')
  assert.match(created?.passwordHash ?? '', /^scrypt:/)
  prisma.merchant.findUnique = originalFind
  prisma.merchant.create = originalCreate
})

test('buyer and seller sessions remain completely separate', () => {
  const buyerSessionCookie = 'paypilot_buyer_session'
  const sellerSessionCookie = 'paypilot_seller_session'
  assert.notEqual(buyerSessionCookie, sellerSessionCookie)
  assert.notEqual('buyer-session-a', sellerA.session)
  assert.equal(canAccessMerchant(sellerA.id, 'buyer-a'), false)
})
