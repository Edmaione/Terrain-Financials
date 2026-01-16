'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

export default function Navigation() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/upload', label: 'Upload CSV' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/categories', label: 'Categories' },
    { href: '/reports', label: 'Reports' },
  ]

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-lg text-white">
              🌿
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">Landscape Finance</h1>
              <p className="text-xs text-slate-500">Maione Landscapes LLC</p>
            </div>
          </Link>
          <div className="hidden sm:flex sm:items-center sm:space-x-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  pathname === link.href
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
            Workspace: Production
          </span>
        </div>
      </div>
    </nav>
  )
}
