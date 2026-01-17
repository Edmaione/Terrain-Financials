import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-smooth focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100',
      className
    )}
    {...props}
  />
))
Select.displayName = 'Select'

export { Select }
