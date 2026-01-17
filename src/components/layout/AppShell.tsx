'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import SidebarNav from '@/components/layout/SidebarNav'
import { Button } from '@/components/ui/Button'
import { IconMenu } from '@/components/ui/icons'
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
        <aside className="fixed inset-y-0 left-0 z-10 hidden w-[260px] border-r border-slate-200 bg-white lg:block">
          <SidebarNav />
        </aside>

        <div className="lg:pl-[260px]">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
            <div className="flex h-12 items-center gap-2 px-4">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
              >
                <IconMenu className="h-5 w-5" />
              </Button>
              <span className="text-sm font-semibold text-slate-900">Terrain Financials</span>
            </div>
          </div>
          <main className="px-4 pb-12 pt-6 lg:px-8">{children}</main>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[260px] bg-white shadow-xl">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
