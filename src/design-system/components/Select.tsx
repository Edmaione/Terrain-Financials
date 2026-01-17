import * as React from 'react'
import clsx from 'clsx'
import { borderRadius, colors, spacing, typography } from '../tokens'
import { tokenVar } from '../utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  state?: 'default' | 'success' | 'warning' | 'error'
}

const stateStyles = {
  default: {
    borderColor: tokenVar('gray-200', colors.gray[200]),
    focusRing: tokenVar('primary-300', colors.primary[300]),
  },
  success: {
    borderColor: tokenVar('success', colors.success),
    focusRing: tokenVar('success', colors.success),
  },
  warning: {
    borderColor: tokenVar('warning', colors.warning),
    focusRing: tokenVar('warning', colors.warning),
  },
  error: {
    borderColor: tokenVar('error', colors.error),
    focusRing: tokenVar('error', colors.error),
  },
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, state = 'default', children, style, ...props }, ref) => {
    const selectedState = stateStyles[state]

    return (
      <select
        ref={ref}
        className={clsx(
          'w-full border bg-transparent text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
          className
        )}
        style={{
          borderRadius: borderRadius.base,
          borderColor: selectedState.borderColor,
          padding: `${spacing[2]} ${spacing[3]}`,
          fontFamily: typography.fonts.sans,
          fontSize: typography.sizes.sm,
          color: tokenVar('gray-900', colors.gray[900]),
          backgroundColor: tokenVar('gray-50', colors.gray[50]),
          ['--ds-focus-ring' as string]: selectedState.focusRing,
          ...style,
        }}
        aria-invalid={state === 'error' ? true : undefined}
        {...props}
      >
        {children}
      </select>
    )
  }
)

Select.displayName = 'Select'
