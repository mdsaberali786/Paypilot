'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart'

export default function Header() {
  const { itemCount, isReady } = useCart()
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              PayPilot
            </Link>
            <span className="ml-2 text-sm text-gray-500">AI Agentic Commerce</span>
          </div>
          <nav className="flex items-center space-x-8">
            <Link
              href="/"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Home
            </Link>
            <Link
              href="/shop"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Shop
            </Link>
            <Link href="/assistant" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Assistant
            </Link>
            <Link href="/cart" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Cart
              {isReady && itemCount > 0 && (
                <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                  {itemCount}
                </span>
              )}
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
