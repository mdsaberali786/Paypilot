import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldSurfaceBlockedToolError } from '../src/components/assistant/AssistantExperience'
import { validateAgentRequest } from '../src/services/agentRequest'
import { validateAgentToolArguments } from '../src/services/agentTools'
import { AgentSessionStore } from '../src/services/agentSession'
import { geminiToolDefinitions, runGeminiToolLoop, searchProductsCallKey, type GeminiInteractionsClient } from '../src/services/commerceAgent'

test('agent API request validation rejects malformed payloads', () => {
  assert.equal(validateAgentRequest({ messages: [{ role: 'system', content: 'hidden' }], cart: [] }), null)
  assert.equal(validateAgentRequest({ messages: [{ role: 'user', content: 'find headphones' }], cart: [{ productId: 'p1', quantity: 1 }] })?.messages.length, 1)
})

test('unknown agent tools are blocked by the allowlist', () => {
  assert.equal(validateAgentToolArguments('change_price', {}), 'This tool is not allowed.')
})

test('Gemini tool declarations preserve the PayPilot tool allowlist', () => {
  assert.deepEqual(geminiToolDefinitions.map((tool) => tool.name), ['search_products', 'get_product_details', 'check_inventory', 'add_to_cart', 'calculate_cart', 'create_order'])
  assert.equal(geminiToolDefinitions.every((tool) => tool.type === 'function' && tool.parameters.type === 'object'), true)
})

test('search_products guidance requires using results without repeating searches', () => {
  const description = geminiToolDefinitions.find((tool) => tool.name === 'search_products')?.description || ''
  assert.match(description, /only when needed/i)
  assert.match(description, /avoid repeating/i)
  assert.match(description, /returned results/i)
})

test('search_products call keys detect insignificant whitespace as duplicates', () => {
  assert.equal(searchProductsCallKey(' SEARCH_PRODUCTS ', { query: '  dining   table ' }), searchProductsCallKey('search_products', { query: 'dining table' }))
})

test('search_products call keys allow materially different criteria', () => {
  assert.notEqual(searchProductsCallKey('search_products', { query: 'dining table', maximumPrice: 5000 }), searchProductsCallKey('search_products', { query: 'dining table', maximumPrice: 7000 }))
  assert.notEqual(searchProductsCallKey('search_products', { query: 'dining table' }), searchProductsCallKey('search_products', { query: 'office chair' }))
})

test('duplicate search_products calls reuse prior results without re-executing the tool', async () => {
  let executions = 0
  let requests = 0
  const client: GeminiInteractionsClient = { interactions: { create: async (request) => {
    requests += 1
    const input = request.input
    if (typeof input === 'string') return { id: 'first', steps: [{ type: 'function_call', id: 'call-1', name: 'search_products', arguments: { query: 'dining   table' } }] }
    if (requests === 2 && Array.isArray(input) && input[0]?.type === 'function_result') return { id: 'second', steps: [{ type: 'function_call', id: 'call-2', name: 'search_products', arguments: { query: ' dining table ' } }] }
    return { id: 'third', output_text: 'Here are the matching tables.', steps: [] }
  } } }
  const result = await runGeminiToolLoop(client, [{ role: 'user', content: 'Find a dining table.' }], { cart: [], confirmed: false, checkoutKey: 'checkout-key' }, async () => {
    executions += 1
    return { tool: 'search_products', status: 'success', data: [{ id: 'p1' }] }
  })
  assert.equal(executions, 1)
  assert.equal(result.actions.length, 2)
  assert.match(result.actions[1].message || '', /already performed/i)
})

test('Gemini tool-call loop executes returned function calls and returns results', async () => {
  const requests: Record<string, unknown>[] = []
  const client: GeminiInteractionsClient = { interactions: { create: async (request) => {
    requests.push(request)
    if (requests.length === 1) return { id: 'first', outputs: [{ type: 'function_call', id: 'call-1', name: 'calculate_cart', arguments: {} }] }
    return { id: 'second', output_text: 'Your current cart total is ready.', outputs: [] }
  } } }
  const result = await runGeminiToolLoop(client, [{ role: 'user', content: 'What is my total?' }], { cart: [], confirmed: false, checkoutKey: 'checkout-key' }, async (name, args) => ({ tool: name, status: 'success', data: args }))
  assert.equal(result.message, 'Your current cart total is ready.')
  assert.equal(result.actions.length, 1)
  assert.deepEqual(requests[1].input, [{ type: 'function_result', call_id: 'call-1', name: 'calculate_cart', result: JSON.stringify(result.actions[0]), is_error: false }])
})

test('Gemini provider failures reach the server error boundary', async () => {
  const client: GeminiInteractionsClient = { interactions: { create: async () => { throw new Error('provider unavailable') } } }
  await assert.rejects(() => runGeminiToolLoop(client, [{ role: 'user', content: 'Hello' }], { cart: [], confirmed: false, checkoutKey: 'checkout-key' }), /provider unavailable/)
})

test('blocked tool errors are hidden when the assistant still returns a final response', () => {
  const actions = [{ tool: 'search_products', status: 'blocked' as const, message: 'A search query is required.' }]
  assert.equal(shouldSurfaceBlockedToolError(actions, 'Here are some tables under ₹5,000.'), false)
  assert.equal(shouldSurfaceBlockedToolError(actions, ''), true)
  assert.equal(shouldSurfaceBlockedToolError(actions, '   '), true)
})

test('add_to_cart requires a product ID and positive integer quantity', () => {
  assert.equal(validateAgentToolArguments('add_to_cart', { productId: 'p1', quantity: 0 }), 'Quantity must be a positive integer.')
  assert.equal(validateAgentToolArguments('add_to_cart', { quantity: 1 }), 'Invalid product ID.')
})

test('confirmation requires an explicit review for the same session and cart', () => {
  const sessions = new AgentSessionStore()
  const cart = [{ productId: 'p1', quantity: 1 }]
  const fingerprint = sessions.updateCart('session-a', cart)
  assert.equal(sessions.canConfirm('session-a', fingerprint), false)
  assert.equal(sessions.markReviewed('session-a', fingerprint), true)
  assert.equal(sessions.canConfirm('session-a', fingerprint), true)
})

test('a cart change invalidates its checkout confirmation', () => {
  const sessions = new AgentSessionStore()
  const originalFingerprint = sessions.updateCart('session-a', [{ productId: 'p1', quantity: 1 }])
  sessions.markReviewed('session-a', originalFingerprint)
  const changedFingerprint = sessions.updateCart('session-a', [{ productId: 'p1', quantity: 2 }])
  assert.notEqual(changedFingerprint, originalFingerprint)
  assert.equal(sessions.canConfirm('session-a', changedFingerprint), false)
})
