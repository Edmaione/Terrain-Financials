import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          {displayLabel && (
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {displayLabel}
            </p>
          )}
          <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">{title}</h1>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </Card>
  )
}
