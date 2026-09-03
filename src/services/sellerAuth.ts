import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

const scrypt = promisify(scryptCallback)
export const SELLER_SESSION_COOKIE = 'paypilot_seller_session'
export const SELLER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
export const SELLER_PASSWORD_MIN_LENGTH = 8

export class SellerAuthError extends Error {}
export function normalizeSellerEmail(email: string) { return email.trim().toLowerCase() }
export function hashSellerSessionToken(token: string) { return createHash('sha256').update(token).digest('hex') }
export function sellerSessionDeleteWhere(token: string) {
  return { tokenHash: hashSellerSessionToken(token) }
}
export function isSellerSessionActive(expiresAt: Date, now = new Date()) { return expiresAt > now }
export async function hashSellerPassword(password: string) {
  if (password.length < SELLER_PASSWORD_MIN_LENGTH) throw new SellerAuthError('Password must be at least 8 characters.')
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${key.toString('hex')}`
}
export async function verifySellerPassword(password: string, storedHash: string | null) {
  if (!storedHash) return false
  const [algorithm, salt, key] = storedHash.split(':')
  if (algorithm !== 'scrypt' || !salt || !key) return false
  const derived = await scrypt(password, salt, 64) as Buffer
  const expected = Buffer.from(key, 'hex')
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}
function validEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) }

export async function registerSeller(name: string, email: string, password: string) {
  const cleanName = name.trim(), cleanEmail = normalizeSellerEmail(email)
  if (!cleanName || cleanName.length > 100) throw new SellerAuthError('Enter a valid name.')
  if (!validEmail(cleanEmail)) throw new SellerAuthError('Enter a valid email address.')
  try {
    const existing = await prisma.merchant.findUnique({ where: { email: cleanEmail } })
    // Never attach credentials to an existing merchant, including passwordless
    // records created by older versions. Their data must remain untouched.
    if (existing) throw new SellerAuthError('An account with that email already exists.')
    const passwordHash = await hashSellerPassword(password)
    return await prisma.merchant.create({ data: { name: cleanName, email: cleanEmail, passwordHash } })
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new SellerAuthError('Unable to create account with those details.')
    throw error
  }
}
export async function authenticateSeller(email: string, password: string) {
  const merchant = await prisma.merchant.findUnique({ where: { email: normalizeSellerEmail(email) } })
  if (!merchant || !(await verifySellerPassword(password, merchant.passwordHash))) throw new SellerAuthError('Invalid email or password.')
  return merchant
}
export async function createSellerSession(merchantId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SELLER_SESSION_TTL_MS)
  await prisma.sellerSession.create({ data: { merchantId, tokenHash: hashSellerSessionToken(token), expiresAt } })
  const store = await cookies()
  store.set(SELLER_SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SELLER_SESSION_TTL_MS / 1000, expires: expiresAt })
}
export async function getCurrentSeller() {
  const token = (await cookies()).get(SELLER_SESSION_COOKIE)?.value
  if (!token) return null
  const session = await prisma.sellerSession.findUnique({ where: { tokenHash: hashSellerSessionToken(token) }, include: { merchant: true } })
  if (!session) return null
  if (!isSellerSessionActive(session.expiresAt)) { await prisma.sellerSession.delete({ where: { id: session.id } }); return null }
  return session.merchant
}
export async function requireSeller() {
  const seller = await getCurrentSeller()
  if (!seller) redirect('/seller/login')
  return seller
}
export async function logoutSeller() {
  const token = (await cookies()).get(SELLER_SESSION_COOKIE)?.value
  if (token) await prisma.sellerSession.deleteMany({ where: sellerSessionDeleteWhere(token) })
  ;(await cookies()).delete(SELLER_SESSION_COOKIE)
}
export function publicSeller(seller: { id: string; email: string; name: string; createdAt: Date }) {
  return { id: seller.id, email: seller.email, name: seller.name, createdAt: seller.createdAt }
}
export function canAccessMerchant(merchantId: string, sellerId: string | null) {
  return sellerId !== null && merchantId === sellerId
}
