'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconBarChart,
  IconFileUp,
  IconLayoutDashboard,
  IconReceipt,
  IconTags,
} from '@/components/ui/icons'
import { cn } from '@/lib/utils'

const sections = [
  {
    label: 'Core',
    items: [
      { href: '/', label: 'Dashboard', icon: IconLayoutDashboard },
      { href: '/transactions', label: 'Transactions', icon: IconReceipt },
      { href: '/upload', label: 'Upload', icon: IconFileUp },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/categories', label: 'Categories', icon: IconTags },
      { href: '/reports', label: 'Reports', icon: IconBarChart },
    ],
  },
]

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col gap-8 px-4 py-6">
      <Link
        href="/"
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
        onClick={onNavigate}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
          <span className="text-lg">🌿</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Terrain Admin</p>
          <p className="text-xs text-slate-500">Maione Landscapes LLC</p>
        </div>
      </Link>

      <nav className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {section.label}
            </p>
            <div className="mt-3 flex flex-col gap-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50',
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <Icon className={cn('h-[18px] w-[18px]', isActive ? 'text-white' : 'text-slate-500')} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Workspace</p>
        <p>Production environment</p>
      </div>
    </div>
  )
}
