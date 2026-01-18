'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { borderRadius, colors, spacing, typography } from '@/design-system/tokens'
import { tokenVar } from '@/design-system/utils'

export default function Navigation() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/upload', label: 'Upload CSV' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/categories', label: 'Categories' },
    { href: '/accounts', label: 'Accounts' },
    { href: '/reports', label: 'Reports' },
  ]

  return (
    <nav
      className="sticky top-0 z-10 border-b backdrop-blur"
      style={{
        backgroundColor: tokenVar('gray-50', colors.gray[50]),
        borderColor: tokenVar('gray-200', colors.gray[200]),
      }}
    >
      <div
        className="mx-auto flex h-16 max-w-7xl items-center justify-between"
        style={{
          paddingLeft: spacing[4],
          paddingRight: spacing[4],
        }}
      >
        <div className="flex items-center" style={{ gap: spacing[8] }}>
          <Link
            href="/"
            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring)] focus-visible:ring-offset-2"
            style={{
              ['--ds-focus-ring' as string]: tokenVar('primary-300', colors.primary[300]),
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center"
              style={{
                borderRadius: borderRadius.lg,
                backgroundColor: tokenVar('primary-600', colors.primary[600]),
                color: tokenVar('gray-50', colors.gray[50]),
                fontSize: typography.sizes.lg,
              }}
            >
              🌿
            </div>
            <div>
              <h1
                style={{
                  fontSize: typography.sizes.base,
                  fontWeight: typography.weights.semibold,
                  color: tokenVar('gray-900', colors.gray[900]),
                }}
              >
                Landscape Finance
              </h1>
              <p
                style={{
                  fontSize: typography.sizes.xs,
                  color: tokenVar('gray-500', colors.gray[500]),
                }}
              >
                Maione Landscapes LLC
              </p>
            </div>
          </Link>
          <div className="hidden sm:flex sm:items-center" style={{ gap: spacing[2] }}>
            {links.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring)] focus-visible:ring-offset-2 hover:bg-[var(--ds-nav-hover)]'
                  )}
                  style={{
                    ['--ds-focus-ring' as string]: tokenVar('primary-300', colors.primary[300]),
                    ['--ds-nav-hover' as string]: tokenVar('gray-100', colors.gray[100]),
                    padding: `${spacing[2]} ${spacing[3]}`,
                    backgroundColor: isActive
                      ? tokenVar('primary-600', colors.primary[600])
                      : 'transparent',
                    color: isActive
                      ? tokenVar('gray-50', colors.gray[50])
                      : tokenVar('gray-600', colors.gray[600]),
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
        <div
          className="hidden md:flex items-center"
          style={{ color: tokenVar('gray-500', colors.gray[500]), gap: spacing[3] }}
        >
          <span
            className="rounded-full border"
            style={{
              padding: `${spacing[1]} ${spacing[3]}`,
              borderColor: tokenVar('gray-200', colors.gray[200]),
              backgroundColor: tokenVar('gray-50', colors.gray[50]),
              fontSize: typography.sizes.xs,
            }}
          >
            Workspace: Production
          </span>
        </div>
      </div>
    </nav>
  )
}
