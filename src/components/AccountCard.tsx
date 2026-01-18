'use client'

import { Account } from '@/types'
import { Badge } from '@/design-system/components/Badge'

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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        min-w-[180px] rounded-2xl border-2 p-4 text-left transition-all
        ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}
      `}
    >
      <div className="text-sm font-medium text-gray-900">{account.name}</div>
      <div className="text-xs text-gray-500">{account.institution || 'Unknown institution'}</div>
      <div className={`mt-1 text-2xl font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
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
    </button>
  )
}
