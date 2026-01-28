'use client'

import { ReconciliationSummary } from '@/types'
import { cn } from '@/lib/utils'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

interface ReconcileBalanceBarProps {
  summary: ReconciliationSummary
}

export default function ReconcileBalanceBar({ summary }: ReconcileBalanceBarProps) {
  const isBalanced = Math.abs(summary.difference) < 0.005
  const cc = summary.is_credit_card

  // For credit cards, display absolute values (statement convention)
  const displayBeginning = cc ? Math.abs(summary.beginning_balance) : summary.beginning_balance
  const displayDeposits = cc ? summary.cleared_deposits : summary.cleared_deposits
  const displayWithdrawals = cc ? summary.cleared_withdrawals : summary.cleared_withdrawals
  const displayComputed = cc ? Math.abs(summary.computed_ending_balance) : summary.computed_ending_balance
  const displayStatement = cc ? Math.abs(summary.statement.ending_balance) : summary.statement.ending_balance
  const displayDifference = cc ? Math.abs(summary.difference) * Math.sign(summary.difference) : summary.difference

  return (
    <div className="grid grid-cols-6 gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <BalanceCell label="Beginning" value={fmt(displayBeginning)} />
      <BalanceCell
        label={cc ? '+ Charges' : '+ Deposits'}
        value={fmt(displayDeposits)}
        className="text-emerald-700"
      />
      <BalanceCell
        label={cc ? '- Payments/Credits' : '- Payments'}
        value={fmt(displayWithdrawals)}
        className="text-rose-600"
      />
      <BalanceCell label="= Computed" value={fmt(displayComputed)} />
      <BalanceCell label="Statement" value={fmt(displayStatement)} />
      <BalanceCell
        label="Difference"
        value={fmt(displayDifference)}
        className={cn(isBalanced ? 'text-emerald-700' : 'text-rose-600')}
        suffix={isBalanced ? ' ✓' : ''}
      />
    </div>
  )
}

function BalanceCell({
  label,
  value,
  className,
  suffix,
}: {
  label: string
  value: string
  className?: string
  suffix?: string
}) {
  return (
    <div className="text-center">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('text-sm font-semibold text-slate-800', className)}>
        {value}{suffix}
      </p>
    </div>
  )
}
