'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  raw_amount?: number
  card?: string
  type?: string
}

interface ValidationCheck {
  name: string
  severity: 'pass' | 'warn' | 'fail'
  message: string
}

interface ValidationResult {
  overall: 'pass' | 'warn' | 'fail'
  checks: ValidationCheck[]
}

interface ExtractionReviewProps {
  transactions: ExtractedTransaction[]
  validation: ValidationResult | null
  beginningBalance?: number
  endingBalance?: number
  accountType?: string
  onConfirm: (transactions: ExtractedTransaction[]) => void
  onCancel: () => void
  submitting?: boolean
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

const SEVERITY_STYLES = {
  pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  fail: 'bg-rose-50 text-rose-700 border-rose-200',
}

const SEVERITY_ICON = {
  pass: '\u2713',
  warn: '\u26A0',
  fail: '\u2717',
}

export default function ExtractionReview({
  transactions: initialTransactions,
  validation,
  beginningBalance,
  endingBalance,
  accountType,
  onConfirm,
  onCancel,
  submitting = false,
}: ExtractionReviewProps) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set())
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editDesc, setEditDesc] = useState('')

  const isCreditCard = accountType === 'credit_card'

  const activeTransactions = useMemo(
    () => transactions.filter((_, i) => !removedIndices.has(i)),
    [transactions, removedIndices]
  )

  const totals = useMemo(() => {
    let credits = 0
    let debits = 0
    for (const t of activeTransactions) {
      if (t.amount >= 0) credits += t.amount
      else debits += Math.abs(t.amount)
    }
    return { credits, debits, net: credits - debits }
  }, [activeTransactions])

  const handleRemove = (idx: number) => {
    setRemovedIndices((prev) => new Set([...prev, idx]))
  }

  const handleRestore = (idx: number) => {
    setRemovedIndices((prev) => {
      const next = new Set(prev)
      next.delete(idx)
      return next
    })
  }

  const handleEditStart = (idx: number) => {
    setEditingIdx(idx)
    setEditDesc(transactions[idx].description)
  }

  const handleEditSave = () => {
    if (editingIdx === null) return
    setTransactions((prev) =>
      prev.map((t, i) => (i === editingIdx ? { ...t, description: editDesc } : t))
    )
    setEditingIdx(null)
  }

  const handleConfirm = () => {
    onConfirm(activeTransactions)
  }

  return (
    <div className="space-y-4">
      {/* Validation Checks */}
      {validation && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Extraction Validation</h4>
          <div className="space-y-1">
            {validation.checks.map((check, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                  SEVERITY_STYLES[check.severity]
                )}
              >
                <span className="font-bold shrink-0">{SEVERITY_ICON[check.severity]}</span>
                <span>{check.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div>
          <p className="text-xs text-slate-500">Transactions</p>
          <p className="text-sm font-semibold">{activeTransactions.length}</p>
          {removedIndices.size > 0 && (
            <p className="text-xs text-slate-400">{removedIndices.size} removed</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500">{isCreditCard ? 'Payments/Credits' : 'Deposits'}</p>
          <p className="text-sm font-semibold text-emerald-600">{fmt(totals.credits)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{isCreditCard ? 'Charges' : 'Withdrawals'}</p>
          <p className="text-sm font-semibold text-rose-600">{fmt(totals.debits)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Net</p>
          <p className={cn('text-sm font-semibold', totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {fmt(totals.net)}
          </p>
        </div>
      </div>

      {/* Balance Check */}
      {beginningBalance != null && endingBalance != null && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Beginning Balance</span>
            <span className="font-medium">{fmt(beginningBalance)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-slate-500">+ Net Change</span>
            <span className="font-medium">{fmt(totals.net)}</span>
          </div>
          <div className="border-t border-slate-100 mt-1 pt-1 flex items-center justify-between">
            <span className="text-slate-500">= Computed Ending</span>
            <span className="font-medium">{fmt(beginningBalance + totals.net)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-slate-500">Statement Ending</span>
            <span className="font-medium">{fmt(endingBalance)}</span>
          </div>
        </div>
      )}

      {/* Transaction Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Description</th>
              {isCreditCard && <th className="px-3 py-2 text-left font-semibold">Card</th>}
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-right font-semibold">Statement Amt</th>
              <th className="px-3 py-2 text-right font-semibold">DB Amount</th>
              <th className="px-3 py-2 text-center font-semibold w-16">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((txn, idx) => {
              const removed = removedIndices.has(idx)
              return (
                <tr
                  key={idx}
                  className={cn(
                    removed && 'opacity-40 line-through bg-slate-50'
                  )}
                >
                  <td className="px-3 py-2 whitespace-nowrap">{txn.date}</td>
                  <td className="px-3 py-2 max-w-[250px] truncate">
                    {editingIdx === idx ? (
                      <div className="flex gap-1">
                        <input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="flex-1 rounded border border-slate-300 px-1 py-0.5 text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave()
                            if (e.key === 'Escape') setEditingIdx(null)
                          }}
                        />
                        <button onClick={handleEditSave} className="text-emerald-600 font-medium">Save</button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-emerald-700"
                        onClick={() => handleEditStart(idx)}
                        title="Click to edit"
                      >
                        {txn.description}
                      </span>
                    )}
                  </td>
                  {isCreditCard && <td className="px-3 py-2 text-slate-400">{txn.card || '-'}</td>}
                  <td className="px-3 py-2">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      txn.type === 'payment' || txn.type === 'credit'
                        ? 'bg-emerald-100 text-emerald-700'
                        : txn.type === 'interest'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    )}>
                      {txn.type || 'txn'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                    {fmt(txn.raw_amount ?? txn.amount)}
                  </td>
                  <td className={cn(
                    'px-3 py-2 text-right font-mono whitespace-nowrap',
                    txn.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  )}>
                    {fmt(txn.amount)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {removed ? (
                      <button
                        onClick={() => handleRestore(idx)}
                        className="text-emerald-600 hover:underline"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemove(idx)}
                        className="text-rose-500 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={submitting || activeTransactions.length === 0}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : `Confirm & Create (${activeTransactions.length} transactions)`}
        </button>
        <button
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
