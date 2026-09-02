import { GoogleGenAI, type Interactions } from '@google/genai'
import { agentToolDefinitions, executeAgentTool, type AgentAction, type AgentContext } from './agentTools'

const instructions = `You are PayPilot's commerce assistant. Use tools for every product, price, stock, cart, or order claim. Never invent products, prices, discounts, payment status, or order results. Recommend only returned products. You can only request the declared PayPilot tools; you cannot access databases, secrets, or external systems. When a customer wants to buy, use calculate_cart and tell them to use the secure Review order control shown by PayPilot. Never claim an order was created unless the create_order tool confirms it. Payment is not collected yet.`

export type AgentMessage = { role: 'user' | 'assistant'; content: string }
type LegacyGeminiFunctionCall = { type: 'function_call'; id: string; name: string; arguments: Record<string, unknown> }
export type GeminiFunctionCall = LegacyGeminiFunctionCall | Interactions.FunctionCallStep
export type GeminiInteraction = Partial<Interactions.Interaction> & { id: string; output_text?: string; outputs?: LegacyGeminiFunctionCall[] }
export type GeminiInteractionsClient = { interactions: { create: (request: Record<string, unknown>) => Promise<GeminiInteraction> } }
type ToolExecutor = (name: string, args: Record<string, unknown>, context: AgentContext) => Promise<AgentAction>

// Definitions remain owned by agentTools.ts, so Gemini can request only PayPilot's declared tools.
export const geminiToolDefinitions = agentToolDefinitions.map(({ name, description, parameters }) => ({ type: 'function', name, description, parameters }))

function conversationInput(messages: AgentMessage[]) {
  return messages.map((message) => `${message.role === 'user' ? 'Customer' : 'PayPilot'}: ${message.content}`).join('\n')
}

function extractInteractionText(interaction: GeminiInteraction) {
  if (typeof interaction.output_text === 'string' && interaction.output_text.length > 0) {
    return interaction.output_text
  }

  for (let index = (interaction.steps?.length ?? 0) - 1; index >= 0; index -= 1) {
    const step = interaction.steps?.[index]
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue

    let text = ''
    for (const part of step.content) {
      if (typeof part !== 'object' || part === null || !('type' in part)) continue
      const candidate = part as { type?: unknown; text?: unknown }
      if (candidate.type === 'text' && typeof candidate.text === 'string') {
        text += candidate.text
      }
    }

    if (text.length > 0) return text
  }

  return undefined
}

function functionCalls(interaction: GeminiInteraction) {
  const steps = Array.isArray(interaction.steps) ? interaction.steps : []
  const stepCalls = steps.filter((step): step is GeminiFunctionCall => (
    step?.type === 'function_call' &&
    typeof step.id === 'string' &&
    typeof step.name === 'string' &&
    step.arguments !== null &&
    typeof step.arguments === 'object' &&
    !Array.isArray(step.arguments)
  ))

  if (stepCalls.length > 0) return stepCalls

  return Array.isArray(interaction.outputs)
    ? interaction.outputs.filter((output): output is GeminiFunctionCall => (
      output?.type === 'function_call' && typeof output.id === 'string' && typeof output.name === 'string'
    ))
    : []
}

export async function runGeminiToolLoop(client: GeminiInteractionsClient, messages: AgentMessage[], context: AgentContext, executeTool: ToolExecutor = executeAgentTool) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  console.log('AI_AGENT', { event: 'agent_request_started' })
  console.log('AI_AGENT', { event: 'gemini_request', iteration: 0, hasPreviousInteraction: false })
  let interaction = await client.interactions.create({ model, input: conversationInput(messages), system_instruction: instructions, tools: geminiToolDefinitions })
  const actions: AgentAction[] = []
  console.log('AI_AGENT', {
    event: 'gemini_response',
    iteration: 0,
    interactionId: interaction.id,
    stepCount: Array.isArray(interaction.steps) ? interaction.steps.length : 0,
    hasOutputText: typeof interaction.output_text === 'string' && interaction.output_text.length > 0,
    functionCallStepCount: Array.isArray(interaction.steps) ? interaction.steps.filter((step) => step?.type === 'function_call').length : 0,
  })

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const calls = functionCalls(interaction)
    if (calls.length === 0) {
      console.log('AI_AGENT', { event: 'final_response_obtained', iteration, interactionId: interaction.id })
      console.log('AI_AGENT', { event: 'tool_loop_exited', iteration, reason: 'final_response' })
      return { message: extractInteractionText(interaction) || 'How can I help you find the right product?', actions }
    }

    const results = []
    for (const call of calls) {
      console.log('AI_AGENT', { event: 'tool_execution_started', iteration, tool: call.name, functionCallId: call.id })
      const args = call.arguments !== null && typeof call.arguments === 'object' && !Array.isArray(call.arguments) ? call.arguments : {}
      const action = await executeTool(call.name, args, context)
      actions.push(action)
      console.log('AI_AGENT', { event: 'tool_execution_completed', iteration, tool: call.name, status: action.status })
      results.push({ type: 'function_result', call_id: call.id, name: call.name, result: JSON.stringify(action), is_error: action.status === 'blocked' })
    }
    console.log('AI_AGENT', { event: 'function_result_submitting', iteration, resultCount: results.length })
    console.log('AI_AGENT', { event: 'gemini_request', iteration: iteration + 1, hasPreviousInteraction: Boolean(interaction.id) })
    interaction = await client.interactions.create({ model, previous_interaction_id: interaction.id, input: results })
    console.log('AI_AGENT', {
      event: 'gemini_response',
      iteration: iteration + 1,
      interactionId: interaction.id,
      stepCount: Array.isArray(interaction.steps) ? interaction.steps.length : 0,
      hasOutputText: typeof interaction.output_text === 'string' && interaction.output_text.length > 0,
      functionCallStepCount: Array.isArray(interaction.steps) ? interaction.steps.filter((step) => step?.type === 'function_call').length : 0,
    })
  }
  console.log('AI_AGENT', { event: 'tool_loop_limit_reached', iteration: 6 })
  console.log('AI_AGENT', { event: 'tool_loop_exited', iteration: 6, reason: 'iteration_limit' })
  throw new Error('The assistant reached its tool-call limit. Please try again.')
}

export async function runCommerceAgent(messages: AgentMessage[], context: AgentContext) {
  if (!process.env.GEMINI_API_KEY) throw new Error('AI commerce assistant is not configured.')
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) as unknown as GeminiInteractionsClient
  return runGeminiToolLoop(client, messages, context)
}
