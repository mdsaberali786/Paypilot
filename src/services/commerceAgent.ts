import { GoogleGenAI } from '@google/genai'
import { agentToolDefinitions, executeAgentTool, type AgentAction, type AgentContext } from './agentTools'

const instructions = `You are PayPilot's commerce assistant. Use tools for every product, price, stock, cart, or order claim. Never invent products, prices, discounts, payment status, or order results. Recommend only returned products. You can only request the declared PayPilot tools; you cannot access databases, secrets, or external systems. When a customer wants to buy, use calculate_cart and tell them to use the secure Review order control shown by PayPilot. Never claim an order was created unless the create_order tool confirms it. Payment is not collected yet.`

export type AgentMessage = { role: 'user' | 'assistant'; content: string }
export type GeminiFunctionCall = { type: 'function_call'; id: string; name: string; arguments: Record<string, unknown> }
export type GeminiInteraction = { id: string; output_text?: string; outputs?: GeminiFunctionCall[] }
export type GeminiInteractionsClient = { interactions: { create: (request: Record<string, unknown>) => Promise<GeminiInteraction> } }
type ToolExecutor = (name: string, args: Record<string, unknown>, context: AgentContext) => Promise<AgentAction>

// Definitions remain owned by agentTools.ts, so Gemini can request only PayPilot's declared tools.
export const geminiToolDefinitions = agentToolDefinitions.map(({ name, description, parameters }) => ({ type: 'function', name, description, parameters }))

function conversationInput(messages: AgentMessage[]) {
  return messages.map((message) => `${message.role === 'user' ? 'Customer' : 'PayPilot'}: ${message.content}`).join('\n')
}

function functionCalls(interaction: GeminiInteraction) {
  return Array.isArray(interaction.outputs)
    ? interaction.outputs.filter((output): output is GeminiFunctionCall => (
      output?.type === 'function_call' && typeof output.id === 'string' && typeof output.name === 'string'
    ))
    : []
}

export async function runGeminiToolLoop(client: GeminiInteractionsClient, messages: AgentMessage[], context: AgentContext, executeTool: ToolExecutor = executeAgentTool) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  let interaction = await client.interactions.create({ model, input: conversationInput(messages), system_instruction: instructions, tools: geminiToolDefinitions })
  const actions: AgentAction[] = []

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const calls = functionCalls(interaction)
    if (calls.length === 0) return { message: interaction.output_text || 'How can I help you find the right product?', actions }

    const results = []
    for (const call of calls) {
      const args = call.arguments !== null && typeof call.arguments === 'object' && !Array.isArray(call.arguments) ? call.arguments : {}
      const action = await executeTool(call.name, args, context)
      actions.push(action)
      results.push({ type: 'function_result', call_id: call.id, name: call.name, result: JSON.stringify(action), is_error: action.status === 'blocked' })
    }
    interaction = await client.interactions.create({ model, previous_interaction_id: interaction.id, input: results })
  }
  throw new Error('The assistant reached its tool-call limit. Please try again.')
}

export async function runCommerceAgent(messages: AgentMessage[], context: AgentContext) {
  if (!process.env.GEMINI_API_KEY) throw new Error('AI commerce assistant is not configured.')
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) as unknown as GeminiInteractionsClient
  return runGeminiToolLoop(client, messages, context)
}
