import * as React from 'react'
import clsx from 'clsx'
import { borderRadius, colors, shadows, spacing } from '../tokens'
import { tokenVar } from '../utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof spacing | 'none'
  shadow?: keyof typeof shadows | 'none'
}

export function Card({
  className,
  padding = 5,
  shadow = 'sm',
  style,
  ...props
}: CardProps) {
  const paddingValue = padding === 'none' ? spacing[0] : spacing[padding] ?? spacing[5]
  const shadowValue = shadow === 'none' ? 'none' : shadows[shadow]

  return (
    <div
      className={clsx('border', className)}
      style={{
        backgroundColor: tokenVar('gray-50', colors.gray[50]),
        borderColor: tokenVar('gray-200', colors.gray[200]),
        borderRadius: borderRadius.xl,
        padding: paddingValue,
        boxShadow: shadowValue,
        ...style,
      }}
      {...props}
    />
  )
}
