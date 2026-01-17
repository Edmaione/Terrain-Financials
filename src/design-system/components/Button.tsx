import * as React from 'react'
import clsx from 'clsx'
import { borderRadius, colors, shadows, spacing, typography } from '../tokens'
import { tokenVar } from '../utils'

const sizeStyles = {
  sm: {
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.sizes.sm,
  },
  md: {
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.sizes.base,
  },
  lg: {
    padding: `${spacing[4]} ${spacing[5]}`,
    fontSize: typography.sizes.lg,
  },
}

const variantStyles = {
  primary: {
    backgroundColor: tokenVar('primary-600', colors.primary[600]),
    color: tokenVar('gray-50', colors.gray[50]),
    borderColor: tokenVar('primary-600', colors.primary[600]),
    boxShadow: shadows.sm,
    hoverBackground: tokenVar('primary-700', colors.primary[700]),
  },
  secondary: {
    backgroundColor: tokenVar('gray-100', colors.gray[100]),
    color: tokenVar('gray-700', colors.gray[700]),
    borderColor: tokenVar('gray-200', colors.gray[200]),
    boxShadow: shadows.sm,
    hoverBackground: tokenVar('gray-200', colors.gray[200]),
  },
  ghost: {
    backgroundColor: 'transparent',
    color: tokenVar('gray-700', colors.gray[700]),
    borderColor: 'transparent',
    boxShadow: 'none',
    hoverBackground: tokenVar('gray-100', colors.gray[100]),
  },
}

type ButtonBaseProps = {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  as?: React.ElementType
}

export type ButtonProps<T extends React.ElementType = 'button'> = ButtonBaseProps &
  Omit<React.ComponentPropsWithoutRef<T>, keyof ButtonBaseProps>

export function Button<T extends React.ElementType = 'button'>({
  variant = 'primary',
  size = 'md',
  children,
  className,
  disabled,
  loading,
  as,
  style,
  ...props
}: ButtonProps<T>) {
  const selectedSize = sizeStyles[size]
  const selectedVariant = variantStyles[variant]
  const Component = as || 'button'

  return (
    <Component
      {...(Component === 'button' ? { type: 'button' } : null)}
      className={clsx(
        'inline-flex items-center justify-center gap-2 border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        'hover:bg-[var(--ds-button-hover)]',
        className
      )}
      style={{
        padding: selectedSize.padding,
        fontSize: selectedSize.fontSize,
        fontFamily: typography.fonts.sans,
        fontWeight: typography.weights.semibold,
        borderRadius: borderRadius.full,
        backgroundColor: selectedVariant.backgroundColor,
        color: selectedVariant.color,
        borderColor: selectedVariant.borderColor,
        boxShadow: selectedVariant.boxShadow,
        ['--ds-button-hover' as string]: selectedVariant.hoverBackground,
        ['--ds-focus-ring' as string]: tokenVar('primary-300', colors.primary[300]),
        ...style,
      }}
      {...props}
      disabled={Component === 'button' ? disabled || loading : undefined}
      aria-busy={loading}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current"
          aria-hidden="true"
        />
      ) : null}
      <span>{children}</span>
    </Component>
  )
}
