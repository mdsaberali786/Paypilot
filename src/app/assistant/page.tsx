import Layout from '@/components/layout/Layout'

export const dynamic = 'force-dynamic'

export default function AssistantPage() {
  return <Layout><main className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8"><p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">PayPilot AI</p><h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">Your shopping copilot is ready.</h1><p className="mx-auto mt-4 max-w-xl text-slate-400">Open the assistant in the corner whenever you want help finding the right product.</p></main></Layout>
}
