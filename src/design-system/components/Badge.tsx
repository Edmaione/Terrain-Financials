import * as React from 'react'
import clsx from 'clsx'
import { borderRadius, colors, spacing, typography } from '../tokens'
import { tokenVar } from '../utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
}

const variantStyles = {
  neutral: {
    backgroundColor: tokenVar('gray-100', colors.gray[100]),
    color: tokenVar('gray-700', colors.gray[700]),
  },
  success: {
    backgroundColor: tokenVar('success-soft', colors.primary[50]),
    color: tokenVar('success', colors.success),
  },
  warning: {
    backgroundColor: tokenVar('warning-soft', colors.gray[100]),
    color: tokenVar('warning', colors.warning),
  },
  error: {
    backgroundColor: tokenVar('error-soft', colors.gray[100]),
    color: tokenVar('error', colors.error),
  },
  info: {
    backgroundColor: tokenVar('info-soft', colors.gray[100]),
    color: tokenVar('info', colors.info),
  },
}

const sizeStyles = {
  sm: {
    padding: `${spacing[1]} ${spacing[2]}`,
    fontSize: typography.sizes.xs,
  },
  md: {
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.sizes.sm,
  },
}

export function Badge({
  className,
  variant = 'neutral',
  size = 'sm',
  style,
  ...props
}: BadgeProps) {
  const selectedVariant = variantStyles[variant]
  const selectedSize = sizeStyles[size]

  return (
    <span
      className={clsx('inline-flex items-center font-semibold', className)}
      style={{
        backgroundColor: selectedVariant.backgroundColor,
        color: selectedVariant.color,
        borderRadius: borderRadius.full,
        padding: selectedSize.padding,
        fontSize: selectedSize.fontSize,
        fontFamily: typography.fonts.sans,
        fontWeight: typography.weights.semibold,
        ...style,
      }}
      {...props}
    />
  )
}
