'use client'

import * as React from 'react'
import { IconAlertTriangle, IconCheckCircle, IconInfo, IconX } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

type Toast = {
  id: string
  title?: string
  description: string
  variant: ToastVariant
}

type ToastContextValue = {
  toast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

const iconMap: Record<ToastVariant, React.ElementType> = {
  success: IconCheckCircle,
  error: IconAlertTriangle,
  info: IconInfo,
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-slate-200 bg-white text-slate-900',
}

const iconStyles: Record<ToastVariant, string> = {
  success: 'text-emerald-600',
  error: 'text-rose-600',
  info: 'text-slate-600',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const toast = React.useCallback((value: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { ...value, id }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 5000)
  }, [])

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed right-6 top-6 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((item) => {
          const Icon = iconMap[item.variant]
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg',
                variantStyles[item.variant]
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5', iconStyles[item.variant])} />
              <div className="flex-1 text-sm">
                {item.title && <p className="font-semibold">{item.title}</p>}
                <p className={item.title ? 'mt-1' : undefined}>{item.description}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="rounded-full p-1 text-slate-500 transition hover:bg-white/60 hover:text-slate-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
