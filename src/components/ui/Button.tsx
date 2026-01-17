import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700',
        secondary:
          'border border-gray-200 bg-white text-gray-700 font-medium shadow-sm hover:bg-gray-50',
        ghost: 'text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900',
        destructive:
          'border border-rose-200 bg-rose-50 text-rose-700 font-medium shadow-sm hover:border-rose-300 hover:text-rose-800',
        outline: 'border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2',
        lg: 'px-5 py-2.5',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
