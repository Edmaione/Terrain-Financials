'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReconciliationSummary, Transaction } from '@/types'
import ReconcileBalanceBar from './ReconcileBalanceBar'
import ReconcileTransactionList from './ReconcileTransactionList'
import UnmatchedTransactionsList from './UnmatchedTransactionsList'
import { apiRequest } from '@/lib/api-client'

type ReconcileTxn = Transaction & { is_cleared: boolean }

interface ReconcileWorkspaceProps {
  initialSummary: ReconciliationSummary
  statementId: string
}

export default function ReconcileWorkspace({
  initialSummary,
  statementId,
}: ReconcileWorkspaceProps) {
  const router = useRouter()
  const [summary, setSummary] = useState(initialSummary)
  const [clearedIds, setClearedIds] = useState<Set<string>>(
    new Set(initialSummary.transactions.filter((t) => t.is_cleared).map((t) => t.id))
  )
  const [saving, setSaving] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [autoMatching, setAutoMatching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isReconciled = summary.statement.status === 'reconciled'

  const refreshSummary = useCallback(async () => {
    try {
      const data = await apiRequest<ReconciliationSummary>(`/api/statements/${statementId}`)
      setSummary(data)
      setClearedIds(new Set(data.transactions.filter((t) => t.is_cleared).map((t) => t.id)))
    } catch {
      // silent
    }
  }, [statementId])

  const toggleTransaction = useCallback(async (id: string) => {
    if (isReconciled) return
    const isCurrentlyCleared = clearedIds.has(id)
    const action = isCurrentlyCleared ? 'unclear' : 'clear'

    // Optimistic update
    setClearedIds((prev) => {
      const next = new Set(prev)
      if (isCurrentlyCleared) next.delete(id)
      else next.add(id)
      return next
    })

    try {
      await apiRequest(`/api/statements/${statementId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_ids: [id], action }),
      })
      await refreshSummary()
    } catch {
      // Revert
      setClearedIds((prev) => {
        const next = new Set(prev)
        if (isCurrentlyCleared) next.add(id)
        else next.delete(id)
        return next
      })
    }
  }, [clearedIds, statementId, isReconciled, refreshSummary])

  const toggleAll = useCallback(async (clear: boolean) => {
    if (isReconciled) return
    const ids = summary.transactions.map((t) => t.id)
    if (ids.length === 0) return

    setSaving(true)
    try {
      await apiRequest(`/api/statements/${statementId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_ids: ids,
          action: clear ? 'clear' : 'unclear',
        }),
      })
      await refreshSummary()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }, [summary.transactions, statementId, isReconciled, refreshSummary])

  const handleAutoMatch = async () => {
    setAutoMatching(true)
    setMessage(null)
    try {
      const result = await apiRequest<{ matched_count: number }>(
        `/api/statements/${statementId}/auto-match`,
        { method: 'POST' }
      )
      setMessage(`Auto-matched ${result.matched_count} transactions`)
      await refreshSummary()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Auto-match failed')
    } finally {
      setAutoMatching(false)
    }
  }

  const handleReconcile = async () => {
    setReconciling(true)
    setMessage(null)
    try {
      const result = await apiRequest<{ reconciled_count: number }>(
        `/api/statements/${statementId}/reconcile`,
        { method: 'POST' }
      )
      setMessage(`Reconciled! ${result.reconciled_count} transactions marked as reconciled.`)
      await refreshSummary()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Reconciliation failed')
    } finally {
      setReconciling(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setMessage(null)
    try {
      await apiRequest(`/api/statements/${statementId}`, { method: 'DELETE' })
      router.push('/reconcile')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // Recompute balance bar with local cleared state
  const localSummary = recomputeSummary(summary, clearedIds)
  const isBalanced = Math.abs(localSummary.difference) < 0.005

  return (
    <div className="space-y-4">
      <ReconcileBalanceBar summary={localSummary} />

      {message && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {message}
        </div>
      )}

      <div className="flex items-center gap-2">
        {!isReconciled && (
          <>
            <button
              onClick={handleAutoMatch}
              disabled={autoMatching}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {autoMatching ? 'Matching…' : 'Auto-match'}
            </button>
            <button
              onClick={handleReconcile}
              disabled={reconciling || !isBalanced}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {reconciling ? 'Reconciling…' : 'Reconcile'}
            </button>
          </>
        )}
        {isReconciled && (
          <span className="text-sm font-medium text-emerald-700">
            Reconciled on {new Date(summary.statement.reconciled_at!).toLocaleDateString()}
          </span>
        )}
        {summary.statement.file_url && (
          <a
            href={summary.statement.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-600 hover:underline"
          >
            Download statement
          </a>
        )}

        <div className="ml-auto">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Delete
            </button>
          ) : (
            <span className="flex items-center gap-2">
              <span className="text-sm text-rose-600">Delete this statement?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </span>
          )}
        </div>
      </div>

      {summary.unmatched_statement_transactions.length > 0 && (
        <UnmatchedTransactionsList
          transactions={summary.unmatched_statement_transactions}
          isCreditCard={summary.is_credit_card}
        />
      )}

      <ReconcileTransactionList
        transactions={summary.transactions}
        clearedIds={clearedIds}
        onToggle={toggleTransaction}
        onToggleAll={toggleAll}
      />
    </div>
  )
}

function recomputeSummary(
  summary: ReconciliationSummary,
  clearedIds: Set<string>
): ReconciliationSummary {
  let clearedDeposits = 0
  let clearedWithdrawals = 0
  let clearedCount = 0
  let unclearedCount = 0

  for (const t of summary.transactions) {
    if (clearedIds.has(t.id)) {
      clearedCount++
      if (t.amount >= 0) clearedDeposits += t.amount
      else clearedWithdrawals += Math.abs(t.amount)
    } else {
      unclearedCount++
    }
  }

  // Use the same sign convention as the server: beginning_balance is already
  // in internal convention (negated for CC by the server)
  const signFlip = summary.is_credit_card ? -1 : 1
  const computedEndingBalance = summary.beginning_balance + clearedDeposits - clearedWithdrawals
  const stmtEndingBalance = summary.statement.ending_balance * signFlip
  const difference = stmtEndingBalance - computedEndingBalance

  return {
    ...summary,
    cleared_deposits: clearedDeposits,
    cleared_withdrawals: clearedWithdrawals,
    computed_ending_balance: computedEndingBalance,
    difference: Math.round(difference * 100) / 100,
    cleared_count: clearedCount,
    uncleared_count: unclearedCount,
    unmatched_statement_transactions: summary.unmatched_statement_transactions,
  }
}
