'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseCSV } from '@/lib/csv-parser'
import { ParsedTransaction } from '@/types'
import { apiRequest } from '@/lib/api-client'
import AlertBanner from '@/components/AlertBanner'

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
      setError(err instanceof Error ? err.message : 'Failed to parse CSV')
    }
  }

  const handleUpload = async () => {
    setUploading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (!accountId) {
        throw new Error('Select an account before uploading.')
      }

      const result = await apiRequest<{
        parsed_count: number
        imported_count: number
        duplicate_count: number
        error_count: number
        errors?: string[]
      }>('/api/upload/csv', {
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

      setTimeout(() => {
        router.push(`/transactions?reviewed=false&range=all&account_id=${accountId}`)
      }, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
            📥
          </div>

          <div>
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-slate-900 font-medium hover:text-slate-700">
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
            Supports Relay, Chase, Bank of America, or any standard bank export
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <label className="label" htmlFor="upload-account">
          Account for import
        </label>
        <select
          id="upload-account"
          value={accountId}
          onChange={(event) => handleAccountChange(event.target.value)}
          className="input w-full sm:max-w-sm"
          aria-label="Select account for upload"
        >
          {accounts.length === 0 && <option value="">No accounts available</option>}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.institution ? ` · ${account.institution}` : ''}
            </option>
          ))}
        </select>
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
            <button
              type="button"
              onClick={() => router.push(`/transactions?reviewed=false&range=all&account_id=${accountId}`)}
              className="btn-primary"
            >
              View transactions
            </button>
          )}
        />
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
            <button
              onClick={handleUpload}
              disabled={uploading || !accountId}
              className="btn-primary disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Import Transactions'}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Payee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {parsedData.slice(0, 50).map((transaction, idx) => (
                    <tr key={idx}>
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
                        className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${
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
