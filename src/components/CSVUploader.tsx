'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconFileUp, IconUploadCloud } from '@/components/ui/icons'
import { parseCSV } from '@/lib/csv-parser'
import { ParsedTransaction } from '@/types'
import { apiRequest } from '@/lib/api-client'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'

type UploadSummary = {
  parsed_count: number
  imported_count: number
  duplicate_count: number
  error_count: number
  errors?: string[]
}

export default function CSVUploader({
  accounts,
  selectedAccountId,
}: {
  accounts: Array<{ id: string; name: string; institution?: string | null }>
  selectedAccountId: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [accountId, setAccountId] = useState(selectedAccountId ?? '')
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null)
  const { toast } = useToast()
  const debugIngest = process.env.NEXT_PUBLIC_INGEST_DEBUG === 'true'

  useEffect(() => {
    setAccountId(selectedAccountId ?? '')
  }, [selectedAccountId])

  const handleAccountChange = (value: string) => {
    setAccountId(value)
    const params = new URLSearchParams(searchParams.toString())
    params.set('account_id', value)
    router.push(`/upload?${params.toString()}`)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.endsWith('.csv')
    )

    if (droppedFiles.length > 0) {
      setFiles(droppedFiles)
      handleParse(droppedFiles)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(selectedFiles)
      handleParse(selectedFiles)
    }
  }

  const handleParse = async (filesToParse: File[]) => {
    setError(null)
    setSuccessMessage(null)
    setParsedData([])
    setUploadSummary(null)

    try {
      const allTransactions: ParsedTransaction[] = []

      for (const file of filesToParse) {
        const transactions = await parseCSV(file)
        allTransactions.push(...transactions)
      }

      if (debugIngest) {
        console.info('[ingest] Parsed transactions', {
          fileCount: filesToParse.length,
          parsedCount: allTransactions.length,
          sample: allTransactions.slice(0, 3),
        })
      }

      setParsedData(allTransactions)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse CSV'
      setError(message)
      toast({
        variant: 'error',
        title: 'Parse failed',
        description: message,
      })
    }
  }

  const handleUpload = async () => {
    setUploading(true)
    setError(null)
    setSuccessMessage(null)
    setUploadSummary(null)

    try {
      if (!accountId) {
        throw new Error('Select an account before uploading.')
      }

      const result = await apiRequest<UploadSummary>('/api/upload/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: parsedData,
          accountId,
        }),
      })

      const message = `Imported ${result.imported_count} transactions. ${result.duplicate_count} duplicates skipped.`
      setSuccessMessage(message)
      setUploadSummary(result)
      toast({
        variant: 'success',
        title: 'Upload complete',
        description: message,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      toast({
        variant: 'error',
        title: 'Upload failed',
        description: message,
      })
    } finally {
      setUploading(false)
    }
  }

  const reviewHref = accountId
    ? `/transactions?reviewed=false&range=all&account_id=${accountId}`
    : '/transactions?reviewed=false&range=all'

  return (
    <div className="space-y-6">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragActive
            ? 'border-slate-900 bg-slate-50'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <div className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <IconUploadCloud className="h-6 w-6" />
          </div>

          <div>
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-slate-900 font-semibold hover:text-slate-700">
                Upload CSV files
              </span>
              <input
                id="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept=".csv"
                onChange={handleFileInput}
              />
            </label>
            <p className="text-slate-500"> or drag and drop</p>
          </div>

          <p className="text-xs text-slate-500">
            Supports Relay, Chase, Bank of America, or any standard bank export.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="upload-account">
          Account for import
        </label>
        <Select
          id="upload-account"
          value={accountId}
          onChange={(event) => handleAccountChange(event.target.value)}
          className="mt-2 w-full sm:max-w-sm"
          aria-label="Select account for upload"
        >
          {accounts.length === 0 && <option value="">No accounts available</option>}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.institution ? ` · ${account.institution}` : ''}
            </option>
          ))}
        </Select>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900">Selected files</h3>
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span className="text-sm text-slate-700">{file.name}</span>
              <span className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <AlertBanner variant="error" title="Upload failed" message={error} />
      )}

      {successMessage && (
        <AlertBanner
          variant="success"
          title="Upload complete"
          message={successMessage}
          actions={(
            <a href={reviewHref} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
              <IconFileUp className="h-4 w-4" />
              Review unreviewed transactions
            </a>
          )}
        />
      )}

      {uploadSummary && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-sm font-semibold text-slate-900">Import summary</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Parsed</p>
              <p className="text-lg font-semibold text-slate-900">{uploadSummary.parsed_count}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Imported</p>
              <p className="text-lg font-semibold text-emerald-600">{uploadSummary.imported_count}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duplicates</p>
              <p className="text-lg font-semibold text-slate-900">{uploadSummary.duplicate_count}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Errors</p>
              <p className="text-lg font-semibold text-rose-600">{uploadSummary.error_count}</p>
            </div>
          </div>
          {uploadSummary.errors && uploadSummary.errors.length > 0 && (
            <details className="mt-4 text-sm text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700">View row-level errors</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                {uploadSummary.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                Parsed {parsedData.length} transactions
              </h3>
              <p className="text-xs text-slate-500">Review the preview before importing.</p>
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading || !accountId}
              variant="primary"
            >
              {uploading ? 'Importing...' : 'Import transactions'}
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Payee</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {parsedData.slice(0, 50).map((transaction, idx) => (
                    <tr key={idx} className="border-b border-slate-100 text-sm text-slate-700">
                      <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                        {transaction.date}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {transaction.payee}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {transaction.description}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-semibold text-right whitespace-nowrap ${
                          transaction.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.length > 50 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  Showing first 50 of {parsedData.length} transactions
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
