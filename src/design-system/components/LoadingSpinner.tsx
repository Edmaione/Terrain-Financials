import * as React from 'react'
import clsx from 'clsx'
import { colors, spacing } from '../tokens'
import { tokenVar } from '../utils'

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const sizeMap = {
  sm: spacing[4],
  md: spacing[6],
  lg: spacing[8],
}

export function LoadingSpinner({
  size = 'md',
  label = 'Loading',
  className,
}: LoadingSpinnerProps) {
  const dimension = sizeMap[size]

  return (
    <span
      role="status"
      aria-label={label}
      className={clsx('inline-flex items-center justify-center', className)}
    >
      <span
        className="animate-spin rounded-full border-2 border-transparent"
        style={{
          width: dimension,
          height: dimension,
          borderColor: tokenVar('gray-200', colors.gray[200]),
          borderTopColor: tokenVar('primary-600', colors.primary[600]),
        }}
      />
    </span>
  )
}
