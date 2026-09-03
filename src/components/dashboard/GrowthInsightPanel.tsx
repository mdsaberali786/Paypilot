'use client'

import { useState } from 'react'

export default function GrowthInsightPanel({ periodDays = 30, supportingMetrics }: { periodDays?: number; supportingMetrics?: { orders: number; conversionRate: number } }) {
  const [insight, setInsight] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/dashboard/growth/insight?days=${periodDays}`, { method: 'POST' })
      const payload = await response.json() as { insight?: string; source?: string; error?: string }
      if (!response.ok || !payload.insight) throw new Error(payload.error || 'Unable to generate an insight.')
      setInsight(payload.insight)
      setSource(payload.source ?? 'fallback')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to generate an insight.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-100 bg-cyan-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Growth insight</h2>
          <p className="mt-1 text-sm text-slate-600">Generate a fresh, aggregate-only recommendation when you need it.</p>
        </div>
        <button type="button" onClick={generate} disabled={loading} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? 'Generating…' : 'Generate insight'}
        </button>
      </div>
      {insight && <p className="mt-4 rounded-xl border border-cyan-200 bg-white p-4 text-sm leading-6 text-slate-700">{insight}<span className="mt-2 block text-xs uppercase tracking-wide text-slate-400">{source === 'gemini' ? 'Gemini insight' : 'Deterministic insight'} · last {periodDays} days · {supportingMetrics?.orders ?? 0} orders · {supportingMetrics?.conversionRate ?? 0}% conversion</span></p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </section>
  )
}
