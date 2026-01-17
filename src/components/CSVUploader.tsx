'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconFileUp, IconUploadCloud } from '@/components/ui/icons'
import { parseCSV } from '@/lib/csv-parser'
import { ImportRecord, ParsedTransaction } from '@/types'
import { apiRequest } from '@/lib/api-client'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'

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
  const [currentImport, setCurrentImport] = useState<ImportRecord | null>(null)
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

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.name.endsWith('.csv')
    )

    if (droppedFiles.length > 0) {
      const firstFile = droppedFiles[0]
      setFiles([firstFile])
      handleParse([firstFile])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      const firstFile = selectedFiles[0]
      if (firstFile) {
        setFiles([firstFile])
        handleParse([firstFile])
      }
    }
  }

  const handleParse = async (filesToParse: File[]) => {
    setError(null)
    setSuccessMessage(null)
    setParsedData([])
    setCurrentImport(null)
    if (searchParams.get('import_id')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('import_id')
      router.push(`/upload?${params.toString()}`)
    }

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

  const fetchImport = async (importId: string) => {
    try {
      const result = await apiRequest<{ import: ImportRecord }>(`/api/imports/${importId}`)
      setCurrentImport(result.import)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load import status'
      setError(message)
    }
  }

  const handleCancelImport = async () => {
    if (!currentImport) return

    try {
      const result = await apiRequest<{ import: ImportRecord }>(`/api/imports/${currentImport.id}`, {
        method: 'PATCH',
      })
      setCurrentImport(result.import)
      toast({
        variant: 'success',
        title: 'Import canceled',
        description: 'The import has been canceled and will stop shortly.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel import'
      toast({
        variant: 'error',
        title: 'Cancel failed',
        description: message,
      })
    }
  }

  useEffect(() => {
    const importIdParam = searchParams.get('import_id')
    if (importIdParam) {
      void fetchImport(importIdParam)
    }
  }, [searchParams])

  useEffect(() => {
    if (!currentImport?.id) return
    if (['succeeded', 'failed', 'canceled'].includes(currentImport.status)) return

    const interval = window.setInterval(() => {
      void fetchImport(currentImport.id)
    }, 2000)

    return () => window.clearInterval(interval)
  }, [currentImport?.id, currentImport?.status])

  const progressPercent = useMemo(() => {
    const total = currentImport?.total_rows ?? 0
    if (!currentImport || total === 0) return 0
    const processed = currentImport.processed_rows ?? 0
    return Math.min(100, Math.round((processed / total) * 100))
  }, [currentImport])

  const handleUpload = async () => {
    setUploading(true)
    setError(null)
    setSuccessMessage(null)
    setCurrentImport(null)

    try {
      if (!accountId) {
        throw new Error('Select an account before uploading.')
      }

      const file = files[0]

      if (!file) {
        throw new Error('Select a CSV file before uploading.')
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountId', accountId)

      const result = await apiRequest<{ import: ImportRecord; existing: boolean }>(
        '/api/upload/csv',
        {
          method: 'POST',
          body: formData,
        }
      )

      if (result.existing) {
        toast({
          variant: 'warning',
          title: 'Import already running',
          description: 'Reconnecting to the active import instead of starting a new one.',
        })
      }

      const params = new URLSearchParams(searchParams.toString())
      params.set('import_id', result.import.id)
      router.push(`/upload?${params.toString()}`)

      setCurrentImport(result.import)

      const message = result.existing
        ? 'Import is already in progress.'
        : 'Import started. We will keep you updated on progress.'
      setSuccessMessage(message)
      toast({
        variant: result.existing ? 'warning' : 'success',
        title: result.existing ? 'Import resumed' : 'Import started',
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
                Upload CSV file
              </span>
              <input
                id="file-upload"
                type="file"
                className="sr-only"
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
          <h3 className="text-sm font-medium text-slate-900">Selected file</h3>
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
          title="Import update"
          message={successMessage}
          actions={currentImport?.status === 'succeeded' ? (
            <a href={reviewHref} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
              <IconFileUp className="h-4 w-4" />
              Review unreviewed transactions
            </a>
          ) : undefined}
        />
      )}

      {currentImport && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Import progress</h3>
              <p className="text-xs text-slate-500">
                Status: <span className="font-semibold text-slate-700">{currentImport.status}</span>
              </p>
              {currentImport.file_name && (
                <p className="text-xs text-slate-400">File: {currentImport.file_name}</p>
              )}
            </div>
            {['queued', 'running'].includes(currentImport.status) && (
              <Button onClick={handleCancelImport} variant="secondary">
                Cancel import
              </Button>
            )}
          </div>

          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {currentImport.processed_rows ?? 0} of {currentImport.total_rows ?? 0} rows processed
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Processed</p>
              <p className="text-lg font-semibold text-slate-900">
                {currentImport.processed_rows ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inserted</p>
              <p className="text-lg font-semibold text-emerald-600">
                {currentImport.inserted_rows ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Skipped</p>
              <p className="text-lg font-semibold text-slate-900">
                {currentImport.skipped_rows ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Errors</p>
              <p className="text-lg font-semibold text-rose-600">
                {currentImport.error_rows ?? 0}
              </p>
            </div>
          </div>
          {currentImport.last_error && currentImport.status === 'failed' && (
            <p className="mt-4 text-sm text-rose-600">{currentImport.last_error}</p>
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
              disabled={
                uploading ||
                !accountId ||
                ['queued', 'running'].includes(currentImport?.status ?? '')
              }
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
