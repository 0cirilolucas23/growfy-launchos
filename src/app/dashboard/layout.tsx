import { Sidebar } from '@/components/sidebar'
import { DashboardHeader } from '@/components/dashboard-header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar (fixa) */}
      <Sidebar />

      {/* Main Content (offset para compensar sidebar) */}
      <div className="ml-64">
        {/* Header */}
        <DashboardHeader />

        {/* Page Content */}
        <main className="min-h-[calc(100vh-73px)]">
          {children}
        </main>
      </div>
    </div>
  )
}
