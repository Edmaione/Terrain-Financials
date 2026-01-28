'use client'

import { useState, useMemo } from 'react'
import { Transaction } from '@/types'
import { cn } from '@/lib/utils'

type ReconcileTxn = Transaction & { is_cleared: boolean }
type SortField = 'date' | 'payee' | 'amount'
type SortDir = 'asc' | 'desc'

interface ReconcileTransactionListProps {
  transactions: ReconcileTxn[]
  clearedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (clear: boolean) => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

export default function ReconcileTransactionList({
  transactions,
  clearedIds,
  onToggle,
  onToggleAll,
}: ReconcileTransactionListProps) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filterCleared, setFilterCleared] = useState<'all' | 'cleared' | 'uncleared'>('all')

  const filteredAndSorted = useMemo(() => {
    let result = [...transactions]

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.payee?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.memo?.toLowerCase().includes(q)
      )
    }

    // Filter by cleared status
    if (filterCleared === 'cleared') {
      result = result.filter((t) => clearedIds.has(t.id))
    } else if (filterCleared === 'uncleared') {
      result = result.filter((t) => !clearedIds.has(t.id))
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') {
        cmp = a.date.localeCompare(b.date)
      } else if (sortField === 'payee') {
        cmp = (a.payee || '').localeCompare(b.payee || '')
      } else if (sortField === 'amount') {
        cmp = a.amount - b.amount
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [transactions, search, sortField, sortDir, filterCleared, clearedIds])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>
    return <span className="text-emerald-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const allCleared = transactions.length > 0 && transactions.every((t) => clearedIds.has(t.id))
  const clearedInView = filteredAndSorted.filter((t) => clearedIds.has(t.id)).length

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payee..."
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />

        <select
          value={filterCleared}
          onChange={(e) => setFilterCleared(e.target.value as typeof filterCleared)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm"
        >
          <option value="all">All transactions</option>
          <option value="cleared">Cleared only</option>
          <option value="uncleared">Uncleared only</option>
        </select>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => onToggleAll(true)}
            className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Select all
          </button>
          <button
            onClick={() => onToggleAll(false)}
            className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Select none
          </button>
        </div>

        <span className="text-xs text-slate-500">
          {clearedInView} of {filteredAndSorted.length} cleared
          {filteredAndSorted.length !== transactions.length && (
            <span className="text-slate-400"> (filtered from {transactions.length})</span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allCleared}
                  onChange={() => onToggleAll(!allCleared)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
              </th>
              <th
                className="px-3 py-2 text-left text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 select-none"
                onClick={() => toggleSort('date')}
              >
                Date <SortIcon field="date" />
              </th>
              <th
                className="px-3 py-2 text-left text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 select-none"
                onClick={() => toggleSort('payee')}
              >
                Payee <SortIcon field="payee" />
              </th>
              <th
                className="px-3 py-2 text-right text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 select-none"
                onClick={() => toggleSort('amount')}
              >
                Amount <SortIcon field="amount" />
              </th>
              <th className="w-10 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((t) => {
              const isCleared = clearedIds.has(t.id)
              return (
                <tr
                  key={t.id}
                  className={cn(
                    'border-b border-slate-100 cursor-pointer hover:bg-slate-50',
                    isCleared && 'bg-emerald-50/50'
                  )}
                  onClick={() => onToggle(t.id)}
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isCleared}
                      onChange={() => onToggle(t.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{t.date}</td>
                  <td className="px-3 py-2 text-slate-700">{t.payee}</td>
                  <td className={cn(
                    'px-3 py-2 text-right font-mono whitespace-nowrap',
                    t.amount >= 0 ? 'text-emerald-700' : 'text-slate-700'
                  )}>
                    {fmt(t.amount)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isCleared && <span className="text-emerald-600 text-xs">✓</span>}
                  </td>
                </tr>
              )
            })}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  {transactions.length === 0 ? 'No transactions in this period.' : 'No matching transactions.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
