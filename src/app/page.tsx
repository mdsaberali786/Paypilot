import Link from 'next/link'
import Layout from '@/components/layout/Layout'

export default async function Home({ searchParams }: { searchParams: Promise<{ assistant?: string }> }) {
  const params = await searchParams
  return (
    <Layout initialAssistantOpen={params.assistant === 'open'}>
      <div className="overflow-hidden">
        <section className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pb-28 lg:pt-28">
          <div className="max-w-3xl">
            <p className="mb-6 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">The intelligent storefront</p>
            <h1 className="text-5xl font-semibold tracking-[-0.05em] text-white sm:text-7xl">A better way to <span className="bg-gradient-to-r from-blue-300 to-cyan-200 bg-clip-text text-transparent">find what fits.</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400">PayPilot brings a considered catalog and an AI shopping copilot together, so every purchase starts with clarity.</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/shop" className="rounded-full bg-white px-6 py-3 font-semibold text-slate-950 hover:-translate-y-0.5 hover:bg-cyan-100">Explore the shop</Link>
              <Link href="/?assistant=open" className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-white/10">Ask PayPilot AI</Link>
            </div>
          </div>
          <div className="mt-20 grid gap-4 sm:grid-cols-3">
            {['Curated products', 'Context-aware guidance', 'Secure checkout review'].map((item, index) => <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"><p className="text-2xl text-cyan-300">0{index + 1}</p><p className="mt-8 font-medium text-white">{item}</p><p className="mt-2 text-sm leading-6 text-slate-500">{index === 0 ? 'A focused catalog that keeps the decision simple.' : index === 1 ? 'Tell us what matters and get useful recommendations.' : 'Review live totals before you choose to place an order.'}</p></div>)}
          </div>
        </section>
      </div>
    </Layout>
  )
}
