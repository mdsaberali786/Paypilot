import Header from './Header'
import Footer from './Footer'
import AssistantExperience from '@/components/assistant/AssistantExperience'

interface LayoutProps {
  children: React.ReactNode
  initialAssistantOpen?: boolean
}

export default function Layout({ children, initialAssistantOpen = false }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#080b12]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <AssistantExperience initialOpen={initialAssistantOpen} />
    </div>
  )
}
