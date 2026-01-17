import * as React from 'react'
import clsx from 'clsx'
import { borderRadius, colors, spacing, typography } from '../tokens'
import { tokenVar } from '../utils'

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx('flex flex-col items-center text-center', className)}
      style={{
        gap: spacing[3],
        color: tokenVar('gray-700', colors.gray[700]),
      }}
    >
      {icon && (
        <div
          style={{
            width: spacing[12],
            height: spacing[12],
            borderRadius: borderRadius.full,
            backgroundColor: tokenVar('gray-100', colors.gray[100]),
            color: tokenVar('gray-600', colors.gray[600]),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p
          style={{
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.semibold,
            color: tokenVar('gray-900', colors.gray[900]),
          }}
        >
          {title}
        </p>
        {description && (
          <p
            style={{
              fontSize: typography.sizes.sm,
              color: tokenVar('gray-500', colors.gray[500]),
            }}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
