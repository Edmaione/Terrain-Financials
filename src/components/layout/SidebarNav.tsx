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
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm"
        onClick={onNavigate}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
          <span className="text-base">🌿</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Terrain Admin</p>
          <p className="text-xs text-slate-500">Maione Landscapes LLC</p>
        </div>
      </Link>

      <nav className="flex flex-col gap-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
              {section.label}
            </p>
            <div className="mt-2 flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50',
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100'
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

      <div className="mt-auto rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Workspace</p>
        <p>Production environment</p>
      </div>
    </div>
  )
}
