import type { ReactNode } from 'react'
import { Card } from '@/design-system/components/Card'
import { colors, spacing } from '@/design-system/tokens'
import { tokenVar } from '@/design-system/utils'

export default function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  label,
}: {
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: string
  label?: string
}) {
  const displayLabel = label ?? eyebrow

  return (
    <Card>
      <div
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between"
        style={{ gap: spacing[4] }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
          {displayLabel && (
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: tokenVar('gray-500', colors.gray[500]) }}
            >
              {displayLabel}
            </p>
          )}
          <h1
            className="text-3xl font-semibold md:text-4xl"
            style={{ color: tokenVar('gray-900', colors.gray[900]) }}
          >
            {title}
          </h1>
          {description && (
            <p className="text-sm" style={{ color: tokenVar('gray-500', colors.gray[500]) }}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center" style={{ gap: spacing[2] }}>
            {actions}
          </div>
        )}
      </div>
    </Card>
  )
}
