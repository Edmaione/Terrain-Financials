'use client'

import { ExtractedTransaction } from '@/types'
import { cn } from '@/lib/utils'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Math.abs(n))
}

interface UnmatchedTransactionsListProps {
  transactions: ExtractedTransaction[]
  isCreditCard: boolean
}

export default function UnmatchedTransactionsList({
  transactions,
  isCreditCard,
}: UnmatchedTransactionsListProps) {
  if (transactions.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-800 mb-3">
        On Statement, Not in System ({transactions.length})
      </h3>
      <p className="text-xs text-amber-700 mb-3">
        These transactions were found on the PDF statement but could not be matched to any transaction in the system.
        You may need to import or manually add them.
      </p>
      <div className="bg-white rounded-lg border border-amber-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-100 bg-amber-50/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-amber-700">Date</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-amber-700">Description</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-amber-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, i) => {
              const isPositive = t.amount >= 0
              // For CC: positive = payment (good), negative = charge
              // For checking: positive = deposit (good), negative = withdrawal
              const colorClass = isPositive ? 'text-emerald-600' : 'text-slate-900'
              return (
                <tr key={i} className="border-b border-amber-50 last:border-0">
                  <td className="px-3 py-2 text-slate-600">{t.date}</td>
                  <td className="px-3 py-2 text-slate-900 font-medium">{t.description}</td>
                  <td className={cn('px-3 py-2 text-right font-medium', colorClass)}>
                    {isPositive ? '+' : '-'}{fmt(t.amount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
