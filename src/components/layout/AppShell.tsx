'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import SidebarNav from '@/components/layout/SidebarNav'
import TopBar from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/ui/Toast'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/50 bg-white lg:block">
          <SidebarNav />
        </aside>

        <div className="lg:pl-64">
          <TopBar onMenuClick={() => setMobileOpen(true)} />
          <main className="px-4 pb-12 pt-6 lg:px-8">{children}</main>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
