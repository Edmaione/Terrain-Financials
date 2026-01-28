'use client'

import Link from 'next/link'
import { StatementGridCell } from '@/types'
import { cn } from '@/lib/utils'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface StatementGridProps {
  grid: StatementGridCell[]
  year: number
}

export default function StatementGrid({ grid, year }: StatementGridProps) {
  // Group by account
  const accountMap = new Map<string, { name: string; cells: StatementGridCell[] }>()
  for (const cell of grid) {
    if (!accountMap.has(cell.account_id)) {
      accountMap.set(cell.account_id, { name: cell.account_name, cells: [] })
    }
    accountMap.get(cell.account_id)!.cells.push(cell)
  }

  const accounts = Array.from(accountMap.entries())

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-3 py-2 text-left font-semibold text-slate-700">Account</th>
            {MONTH_LABELS.map((m) => (
              <th key={m} className="px-2 py-2 text-center font-medium text-slate-500 text-xs">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map(([accountId, { name, cells }]) => (
            <tr key={accountId} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{name}</td>
              {cells.map((cell) => {
                const month = cell.month.substring(5, 7)
                const monthIdx = parseInt(month, 10)
                return (
                  <td key={cell.month} className="px-2 py-2 text-center">
                    {cell.statement_id ? (
                      <Link
                        href={`/reconcile/${cell.statement_id}`}
                        className={cn(
                          'inline-block h-6 w-6 rounded-full text-xs leading-6',
                          cell.status === 'reconciled'
                            ? 'bg-emerald-100 text-emerald-700'
                            : cell.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        )}
                        title={`${cell.status} — click to open`}
                      >
                        {cell.status === 'reconciled' ? '✓' : cell.status === 'in_progress' ? '…' : '○'}
                      </Link>
                    ) : (
                      <Link
                        href={`/reconcile/new?account_id=${accountId}&month=${year}-${String(monthIdx).padStart(2, '0')}`}
                        className="inline-block h-6 w-6 rounded-full bg-slate-50 text-xs leading-6 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                        title="Upload statement"
                      >
                        +
                      </Link>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
