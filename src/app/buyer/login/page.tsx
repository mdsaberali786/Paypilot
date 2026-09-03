'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/layout/Layout'

export default function BuyerLoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      const response = await fetch(`/api/buyer/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, email, password } : { email, password }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to authenticate.')
      router.push('/shop')
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to authenticate.')
      setIsSubmitting(false)
    }
  }

  return <Layout><main className="mx-auto flex max-w-5xl justify-center px-4 py-16 sm:px-6"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-slate-950/20 backdrop-blur sm:p-9"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Buyer access</p><h1 className="mt-4 text-3xl font-semibold text-white">{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1><p className="mt-2 text-sm leading-6 text-slate-400">Keep your shopping experience and orders in sync.</p><form onSubmit={submit} className="mt-8 space-y-4">{mode === 'register' && <label className="block text-sm font-medium text-slate-300">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white" /></label>}<label className="block text-sm font-medium text-slate-300">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white" /></label><label className="block text-sm font-medium text-slate-300">Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white" /></label>{error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}<button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">{isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} className="mt-5 w-full text-sm font-medium text-cyan-300 hover:text-white">{mode === 'login' ? 'New to PayPilot? Create an account' : 'Already have an account? Sign in'}</button><Link href="/shop" className="mt-5 block text-center text-sm font-semibold text-cyan-300 hover:text-white">Continue shopping →</Link></section></main></Layout>
}
