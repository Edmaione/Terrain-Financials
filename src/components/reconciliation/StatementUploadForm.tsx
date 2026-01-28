'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Account, ExtractedStatementData } from '@/types'
import { cn } from '@/lib/utils'

interface StatementUploadFormProps {
  accounts: Account[]
  defaultAccountId?: string
  defaultMonth?: string // "YYYY-MM"
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

export default function StatementUploadForm({
  accounts,
  defaultAccountId,
  defaultMonth,
}: StatementUploadFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [accountId, setAccountId] = useState(defaultAccountId || '')
  const [periodStart, setPeriodStart] = useState(
    defaultMonth ? `${defaultMonth}-01` : ''
  )
  const [periodEnd, setPeriodEnd] = useState(() => {
    if (!defaultMonth) return ''
    const [y, m] = defaultMonth.split('-').map(Number)
    const last = new Date(y, m, 0)
    return `${y}-${String(m).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  })
  const [endingBalance, setEndingBalance] = useState('')
  const [beginningBalance, setBeginningBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedStatementData | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const selectedAccount = accounts.find(a => a.id === accountId)

  const processFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setExtractedData(null)
    setError(null)

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) return

    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const res = await fetch('/api/statements/parse-pdf', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'PDF parsing failed')

      const data = json.data as ExtractedStatementData
      setExtractedData(data)

      // Auto-fill form fields
      if (data.period_start) setPeriodStart(data.period_start)
      if (data.period_end) setPeriodEnd(data.period_end)
      if (data.ending_balance != null) setEndingBalance(String(data.ending_balance))
      if (data.beginning_balance != null) setBeginningBalance(String(data.beginning_balance))

      // Auto-select account by last4 match
      if (data.account_number_last4 && !accountId) {
        const match = accounts.find(a => a.last4 === data.account_number_last4)
        if (match) setAccountId(match.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF parsing failed')
    } finally {
      setParsing(false)
    }
  }, [accountId, accounts])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    if (selectedFile) processFile(selectedFile)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) processFile(droppedFile)
  }, [processFile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId || !periodStart || !periodEnd || !endingBalance) {
      setError('Account, period dates, and ending balance are required.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('account_id', accountId)
      fd.append('period_start', periodStart)
      fd.append('period_end', periodEnd)
      fd.append('ending_balance', endingBalance)
      if (beginningBalance) fd.append('beginning_balance', beginningBalance)
      if (notes) fd.append('notes', notes)
      if (file) fd.append('file', file)

      const res = await fetch('/api/statements', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to create statement')

      // If we have extracted transactions, match them and save extracted data
      if (extractedData?.transactions?.length) {
        try {
          await fetch(`/api/statements/${json.data.id}/match-extracted`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactions: extractedData.transactions,
              extractedData: extractedData,
            }),
          })
        } catch {
          // Non-fatal — matching is best-effort
        }
      }

      router.push(`/reconcile/${json.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Hidden file input - outside the drop zone to avoid click conflicts */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.csv,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="absolute opacity-0 pointer-events-none"
        style={{ width: 0, height: 0 }}
      />

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          isDragOver
            ? 'border-emerald-500 bg-emerald-50'
            : file
            ? 'border-emerald-300 bg-emerald-50/50'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
        )}
      >

        {parsing ? (
          <div className="space-y-2">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
            <p className="text-sm font-medium text-emerald-700">Analyzing PDF...</p>
            <p className="text-xs text-slate-500">Extracting dates, balances, and transactions</p>
          </div>
        ) : file ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-emerald-700">{file.name}</p>
            <p className="text-xs text-slate-500">Click or drop to replace</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl text-slate-300">+</div>
            <p className="text-sm font-medium text-slate-600">
              Drop a PDF statement here, or click to select
            </p>
            <p className="text-xs text-slate-400">
              Supports PDF, CSV, or images
            </p>
          </div>
        )}
      </div>

      {/* Extraction Preview Card */}
      {extractedData && (
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {extractedData.account_type === 'credit_card' ? 'Credit Card' : 'Bank'} Statement
              </h3>
              {extractedData.account_number_last4 && (
                <p className="text-sm text-slate-500">
                  Account ending in {extractedData.account_number_last4}
                </p>
              )}
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              Extracted
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Period</p>
              <p className="text-sm font-medium text-slate-900">
                {extractedData.period_start} to {extractedData.period_end}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Transactions</p>
              <p className="text-sm font-medium text-slate-900">
                {extractedData.transactions?.length || 0} found
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-3 bg-white rounded-lg border border-emerald-100">
            <div>
              <p className="text-xs font-medium text-slate-500">Previous Balance</p>
              <p className="text-lg font-semibold text-slate-900">
                {fmt(extractedData.beginning_balance)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">New Balance</p>
              <p className="text-lg font-semibold text-slate-900">
                {fmt(extractedData.ending_balance)}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Account *
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            required
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.last4 && `(...${a.last4})`}
              </option>
            ))}
          </select>
          {selectedAccount && extractedData?.account_number_last4 &&
           selectedAccount.last4 === extractedData.account_number_last4 && (
            <p className="mt-1 text-xs text-emerald-600">
              Auto-matched by account number
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Period start *
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Period end *
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ending balance *
            </label>
            <input
              type="number"
              step="0.01"
              value={endingBalance}
              onChange={(e) => setEndingBalance(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Beginning balance
            </label>
            <input
              type="number"
              step="0.01"
              value={beginningBalance}
              onChange={(e) => setBeginningBalance(e.target.value)}
              placeholder="Auto-calculated if blank"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm min-h-[60px]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || parsing}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : extractedData ? 'Create & Start Reconciling' : 'Create Statement'}
        </button>
      </form>
    </div>
  )
}
