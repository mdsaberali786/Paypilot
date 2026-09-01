import Link from 'next/link'
import Layout from '@/components/layout/Layout'

export default function Home() {
  return (
    <Layout>
      <div className="bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              PayPilot
            </h1>
            <p className="mt-4 text-xl text-gray-600">
              AI Agentic Commerce Engine
            </p>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-500">
              An intelligent commerce system that helps merchants increase conversion and revenue through AI-powered customer interactions and seamless payment integration.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link
                href="/shop"
                className="rounded-md bg-blue-600 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700"
              >
                Start Shopping
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md border border-gray-300 bg-white px-8 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Merchant Dashboard
              </Link>
            </div>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">AI-Powered Commerce</h3>
              <p className="mt-2 text-gray-600">
                Intelligent agent that understands customer intent and provides personalized product recommendations.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Seamless Payments</h3>
              <p className="mt-2 text-gray-600">
                Integrated with Razorpay for secure, reliable payment processing with real-time status tracking.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Analytics & Insights</h3>
              <p className="mt-2 text-gray-600">
                Comprehensive dashboard with revenue metrics, conversion tracking, and AI decision audit trails.
              </p>
            </div>
          </div>

          <div className="mt-20 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Built for Razorpay AI Buildathon 2026</h2>
            <p className="mt-4 text-lg text-gray-600">
              Track: AI Growth & Agentic Commerce
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
