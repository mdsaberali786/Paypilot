import { createHash, randomUUID } from 'crypto'

export type SessionCartItem = { productId: string; quantity: number }

type AgentSession = {
  checkoutKey: string
  cartFingerprint?: string
  reviewedFingerprint?: string
}

export class AgentSessionStore {
  private sessions = new Map<string, AgentSession>()

  fingerprint(cart: SessionCartItem[]) {
    const items = [...cart]
      .sort((left, right) => left.productId.localeCompare(right.productId))
      .map((item) => `${item.productId}:${item.quantity}`)
      .join('|')
    return createHash('sha256').update(items).digest('hex')
  }

  ensure(sessionId: string) {
    let session = this.sessions.get(sessionId)
    if (!session) {
      session = { checkoutKey: randomUUID() }
      this.sessions.set(sessionId, session)
    }
    return session
  }

  updateCart(sessionId: string, cart: SessionCartItem[]) {
    const session = this.ensure(sessionId)
    const fingerprint = this.fingerprint(cart)
    if (session.cartFingerprint !== fingerprint) {
      session.cartFingerprint = fingerprint
      session.reviewedFingerprint = undefined
    }
    return fingerprint
  }

  markReviewed(sessionId: string, fingerprint: string) {
    const session = this.ensure(sessionId)
    if (session.cartFingerprint !== fingerprint) return false
    session.reviewedFingerprint = fingerprint
    return true
  }

  canConfirm(sessionId: string, fingerprint: string) {
    const session = this.ensure(sessionId)
    return session.cartFingerprint === fingerprint && session.reviewedFingerprint === fingerprint
  }

  checkoutKey(sessionId: string) {
    return this.ensure(sessionId).checkoutKey
  }

  clearReview(sessionId: string) {
    this.ensure(sessionId).reviewedFingerprint = undefined
  }
}

export const agentSessionStore = new AgentSessionStore()
