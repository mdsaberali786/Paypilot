'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/layout/Layout'

export default function SellerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch(registering ? '/api/seller/register' : '/api/seller/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(registering ? { name, email, password } : { email, password }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to sign you in.')
      router.push('/dashboard'); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign you in.') } finally { setBusy(false) }
  }
  return <Layout><main className="mx-auto flex max-w-5xl justify-center px-4 py-16 sm:px-6"><section className="w-full max-w-md rounded-3xl border border-blue-200/20 bg-gradient-to-br from-blue-950 to-slate-950 p-7 shadow-2xl sm:p-9"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">Seller console</p><h1 className="mt-4 text-3xl font-semibold text-white">{registering ? 'Create your seller account.' : 'Run your store with clarity.'}</h1><p className="mt-2 text-sm leading-6 text-slate-400">{registering ? 'Create a new merchant account. Existing accounts cannot be claimed.' : 'Sign in to manage your catalog and orders.'}</p><form onSubmit={submit} className="mt-8 space-y-4">{registering && <label className="block text-sm font-medium text-slate-300">Store name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Acme Store" className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white placeholder:text-slate-600" /></label>}<label className="block text-sm font-medium text-slate-300">Work email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="merchant@company.com" className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white placeholder:text-slate-600" /></label><label className="block text-sm font-medium text-slate-300">Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white placeholder:text-slate-600" /></label>{error && <p role="alert" className="rounded-xl bg-rose-500/20 p-3 text-sm text-rose-200">{error}</p>}<button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? (registering ? 'Creating account…' : 'Signing in…') : (registering ? 'Create seller account' : 'Sign in')}</button></form><button type="button" onClick={() => { setRegistering(!registering); setError('') }} className="mt-5 w-full text-center text-sm font-semibold text-blue-300 hover:text-white">{registering ? 'Already have an account? Sign in' : 'New seller? Create an account'}</button><Link href="/" className="mt-5 block text-center text-sm font-semibold text-blue-300 hover:text-white">← Back to storefront</Link></section></main></Layout>
}
