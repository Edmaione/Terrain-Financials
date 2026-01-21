import type { ReactNode } from 'react'
import { IconAlertTriangle, IconCheckCircle, IconInfo } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

const styles: Record<string, { wrapper: string; icon: string; iconEl: React.ElementType }> = {
  error: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: 'text-rose-600',
    iconEl: IconAlertTriangle,
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'text-emerald-600',
    iconEl: IconCheckCircle,
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'text-amber-600',
    iconEl: IconAlertTriangle,
  },
  info: {
    wrapper: 'border-slate-200 bg-white text-slate-900',
    icon: 'text-slate-600',
    iconEl: IconInfo,
  },
}

export default function AlertBanner({
  variant = 'info',
  title,
  message,
  actions,
}: {
  variant?: 'error' | 'success' | 'warning' | 'info'
  title?: string
  message: string
  actions?: ReactNode
}) {
  const config = styles[variant]
  const Icon = config.iconEl

  return (
    <div className={cn('rounded-2xl border px-4 py-3 text-sm', config.wrapper)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5', config.icon)} />
        <div className="flex-1">
          {title && <p className="font-semibold">{title}</p>}
          <p className={title ? 'mt-1' : undefined}>{message}</p>
          {actions && <div className="mt-3">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
