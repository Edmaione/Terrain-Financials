'use client'

import { Account } from '@/types'
import { Badge } from '@/design-system/components/Badge'
import { Card } from '@/design-system/components/Card'
import { colors } from '@/design-system/tokens'
import { tokenVar } from '@/design-system/utils'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

interface AccountCardProps {
  account: Account
  balance: number
  isSelected: boolean
  pendingCount: number
  unreviewedCount: number
  lastUpdate: string
  onClick: () => void
}

export function AccountCard({
  account,
  balance,
  isSelected,
  pendingCount,
  unreviewedCount,
  lastUpdate,
  onClick,
}: AccountCardProps) {
  const cardStyles = isSelected
    ? {
        borderColor: tokenVar('primary-600', colors.primary[600]),
        backgroundColor: tokenVar('primary-50', colors.primary[50]),
      }
    : {
        borderColor: tokenVar('gray-200', colors.gray[200]),
        backgroundColor: tokenVar('gray-50', colors.gray[50]),
      }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className="min-w-[200px] text-left transition-all focus:outline-none"
    >
      <Card
        padding={4}
        className="h-full border-2 shadow-none transition-colors"
        style={cardStyles}
      >
        <div className="text-sm font-medium text-gray-900">{account.name}</div>
        <div className="text-xs text-gray-500">
          {account.institution || 'Unknown institution'}
        </div>
        <div
          className={`mt-1 text-2xl font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}
        >
          {currencyFormatter.format(Math.abs(balance))}
        </div>
        <div className="mt-2 text-xs text-gray-500">{lastUpdate}</div>
        {(pendingCount > 0 || unreviewedCount > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingCount > 0 && (
              <Badge variant="warning" size="sm">
                {pendingCount} pending
              </Badge>
            )}
            {unreviewedCount > 0 && (
              <Badge variant="info" size="sm">
                {unreviewedCount} review
              </Badge>
            )}
          </div>
        )}
      </Card>
    </button>
  )
}
