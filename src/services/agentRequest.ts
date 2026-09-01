import type { AgentMessage } from './commerceAgent'
import type { AgentCartItem } from './agentTools'

export type AgentRequest = { messages: AgentMessage[]; cart: AgentCartItem[] }

export function validateAgentRequest(body: unknown): AgentRequest | null {
  if (!body || typeof body !== 'object') return null
  const { messages, cart } = body as { messages?: unknown; cart?: unknown }
  if (!Array.isArray(messages) || !Array.isArray(cart) || messages.length > 12 || cart.length > 50) return null
  if (!messages.every((message) => (
    message && typeof message === 'object' &&
    ((message as AgentMessage).role === 'user' || (message as AgentMessage).role === 'assistant') &&
    typeof (message as AgentMessage).content === 'string' && (message as AgentMessage).content.length <= 4_000
  ))) return null
  if (!cart.every((item) => (
    item && typeof item === 'object' &&
    typeof (item as AgentCartItem).productId === 'string' && (item as AgentCartItem).productId.length > 0 &&
    Number.isInteger((item as AgentCartItem).quantity) && (item as AgentCartItem).quantity > 0
  ))) return null
  return { messages: messages as AgentMessage[], cart: cart as AgentCartItem[] }
}
