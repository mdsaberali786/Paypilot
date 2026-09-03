'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    try {
      await fetch('/api/seller/logout', { method: 'POST' })
    } finally {
      router.push('/seller/login')
      router.refresh()
    }
  }

  const navItems = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/products', label: 'Products' },
    { href: '/dashboard/orders', label: 'Orders' },
    { href: '/dashboard/activity', label: 'Audit Trail' },
    { href: '/dashboard/payments', label: 'Payments' },
    { href: '/dashboard/ai-activity', label: 'AI Activity' },
  ]

  return (
    <nav className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="py-4 text-lg font-semibold tracking-tight">PayPilot <span className="text-cyan-300">for sellers</span></Link>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {navItems.map((item) => item.href && <Link key={item.href} href={item.href} className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${pathname === item.href ? 'border-cyan-300 text-white' : 'border-transparent text-slate-400 hover:border-slate-500 hover:text-white'}`}>{item.label}</Link>)}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/shop" className="text-sm text-slate-400 hover:text-white">View store →</Link>
          <button type="button" onClick={logout} disabled={loggingOut} className="text-sm font-medium text-slate-300 hover:text-white disabled:opacity-50">{loggingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </div>
    </nav>
  )
}
