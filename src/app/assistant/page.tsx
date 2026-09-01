import Layout from '@/components/layout/Layout'
import AssistantExperience from '@/components/assistant/AssistantExperience'

export const dynamic = 'force-dynamic'

export default function AssistantPage() {
  return <Layout><main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><AssistantExperience /></main></Layout>
}
