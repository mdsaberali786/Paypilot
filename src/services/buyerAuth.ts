import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const scrypt = promisify(scryptCallback)
const SESSION_COOKIE = 'paypilot_buyer_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const PASSWORD_MIN_LENGTH = 8

export class BuyerAuthError extends Error {}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase()
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function hashPassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) throw new BuyerAuthError('Password must be at least 8 characters.')
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, key] = storedHash.split(':')
  if (algorithm !== 'scrypt' || !salt || !key) return false
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  const expected = Buffer.from(key, 'hex')
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey)
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function registerBuyer(name: string, email: string, password: string) {
  const cleanName = name.trim()
  const cleanEmail = normaliseEmail(email)
  if (!cleanName || cleanName.length > 100) throw new BuyerAuthError('Enter a valid name.')
  if (!validateEmail(cleanEmail)) throw new BuyerAuthError('Enter a valid email address.')
  const passwordHash = await hashPassword(password)
  try {
    return await prisma.buyer.create({ data: { name: cleanName, email: cleanEmail, passwordHash } })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new BuyerAuthError('Unable to create account with those details.')
    }
    throw error
  }
}

export async function createBuyerSession(buyerId: string) {
  const token = randomBytes(32).toString('base64url')
  await prisma.buyerSession.create({
    data: {
      buyerId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function authenticateBuyer(email: string, password: string) {
  const buyer = await prisma.buyer.findUnique({ where: { email: normaliseEmail(email) } })
  if (!buyer || !(await verifyPassword(password, buyer.passwordHash))) throw new BuyerAuthError('Invalid email or password.')
  return buyer
}

export async function getCurrentBuyer() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await prisma.buyerSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { buyer: true },
  })
  if (!session) return null
  if (session.expiresAt <= new Date()) {
    await prisma.buyerSession.delete({ where: { id: session.id } })
    return null
  }
  return session.buyer
}

export async function logoutBuyer() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) await prisma.buyerSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
  cookieStore.delete(SESSION_COOKIE)
}

export function publicBuyer(buyer: { id: string; email: string; name: string; createdAt: Date }) {
  return { id: buyer.id, email: buyer.email, name: buyer.name, createdAt: buyer.createdAt }
}

export function canAccessBuyerOrder(orderBuyerId: string | null, currentBuyerId: string | null) {
  return orderBuyerId !== null && currentBuyerId !== null && orderBuyerId === currentBuyerId
}

export { PASSWORD_MIN_LENGTH }
