'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconFileUp, IconUploadCloud } from '@/components/ui/icons'
import { parseCSV } from '@/lib/csv-parser'
import { AccountDetectionResult } from '@/lib/account-detection'
import {
  computeHeaderFingerprint,
  computeHeaderSignature,
} from '@/lib/import-header-fingerprint'
import {
  buildMappingPayload,
  detectMappingFromHeaders,
  normalizeImportMapping,
  validateMapping,
} from '@/lib/import-mapping'
import { CanonicalImportRow, transformImportRows } from '@/lib/import/transform-to-canonical'
import { detectDateFormatFromRows, type DateFormatHint } from '@/lib/import-date-format'
import {
  ALLOWED_POSTING_STATUSES,
  normalizeStatusKey,
  type StatusMappingValue,
} from '@/lib/import-status'
import { AmountStrategy, CSVRow, ImportFieldMapping, ImportProfile, ImportRecord } from '@/types'
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
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([])
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([])
  const [headerFingerprint, setHeaderFingerprint] = useState<string | null>(null)
  const [headerSignature, setHeaderSignature] = useState<string | null>(null)
  const [mapping, setMapping] = useState<ImportFieldMapping>({
    date: null,
    amount: null,
    inflow: null,
    outflow: null,
    payee: null,
    description: null,
    memo: null,
    reference: null,
    category_name: null,
    status: null,
  })
  const [amountStrategy, setAmountStrategy] = useState<AmountStrategy>('signed')
  const [mappingId, setMappingId] = useState<string | null>(null)
  const [mappingName, setMappingName] = useState('')
  const [saveTemplate, setSaveTemplate] = useState(false)
  const [mappingDirty, setMappingDirty] = useState(false)
  const [mappingLoading, setMappingLoading] = useState(false)
  const [showMoreFields, setShowMoreFields] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [accountId, setAccountId] = useState(selectedAccountId ?? '')
  const [accountTouched, setAccountTouched] = useState(false)
  const [accountSuggestion, setAccountSuggestion] = useState<AccountDetectionResult | null>(null)
  const [detectionLoading, setDetectionLoading] = useState(false)
  const [detectedInstitution, setDetectedInstitution] = useState<string | null>(null)
  const [currentImport, setCurrentImport] = useState<ImportRecord | null>(null)
  const [previewResult, setPreviewResult] = useState<{
    transactions: CanonicalImportRow[]
    errors: Array<{ rowNumber: number; field: string; message: string }>
  }>({ transactions: [], errors: [] })
  const [previewLoading, setPreviewLoading] = useState(false)
  const [statusValues, setStatusValues] = useState<Array<{ value: string; key: string }>>([])
  const [statusMap, setStatusMap] = useState<Record<string, StatusMappingValue | ''>>({})
  const [skipInvalidRows, setSkipInvalidRows] = useState(false)
  const [importProfile, setImportProfile] = useState<ImportProfile | null>(null)
  const { toast } = useToast()
  const debugIngest = process.env.NEXT_PUBLIC_INGEST_DEBUG === 'true'
  const confidenceThreshold = 0.75

  useEffect(() => {
    setAccountId(selectedAccountId ?? '')
  }, [selectedAccountId])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accounts, accountId]
  )

  const handleAccountChange = (value: string) => {
    setAccountTouched(true)
    setAccountId(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('account_id', value)
    } else {
      params.delete('account_id')
    }
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
    setParsedRows([])
    setParsedHeaders([])
    setHeaderFingerprint(null)
    setHeaderSignature(null)
    setCurrentImport(null)
    setAccountSuggestion(null)
    setAccountTouched(false)
    setDetectedInstitution(null)
    setStatusValues([])
    setStatusMap({})
    setSkipInvalidRows(false)
    setImportProfile(null)
    const shouldAutoSelect = true
    if (searchParams.get('import_id')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('import_id')
      router.push(`/upload?${params.toString()}`)
    }

    try {
      const allRows: CSVRow[] = []
      let headers: string[] = []
      const firstFile = filesToParse[0]

      for (const file of filesToParse) {
        const parsed = await parseCSV(file)
        headers = parsed.headers
        allRows.push(...parsed.rows)
      }

      if (debugIngest) {
        console.info('[ingest] Parsed transactions', {
          fileCount: filesToParse.length,
          parsedCount: allRows.length,
          sample: allRows.slice(0, 3),
        })
      }

      const fingerprint = headers.length > 0 ? await computeHeaderFingerprint(headers) : null
      const signature =
        headers.length > 0 ? await computeHeaderSignature({ headers, rows: allRows }) : null
      const detected = detectMappingFromHeaders(headers)

      setParsedRows(allRows)
      setParsedHeaders(headers)
      setHeaderFingerprint(fingerprint)
      setHeaderSignature(signature)
      setMapping(normalizeImportMapping(detected.mapping))
      setAmountStrategy(detected.amountStrategy)
      setMappingId(null)
      setMappingName('')
      setSaveTemplate(false)
      setMappingDirty(false)
      setShowMoreFields(false)

      if (firstFile && (fingerprint || signature)) {
        setDetectionLoading(true)
        try {
          const fileText = await firstFile.text()
          const detectionResponse = await apiRequest<{
            detection: AccountDetectionResult
          }>('/api/imports/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileText,
              headerFingerprint: fingerprint,
              headerSignature: signature,
            }),
          })

          const detection = detectionResponse.detection
          setAccountSuggestion(detection)
          const fallbackInstitution = fileText.toLowerCase().includes('relay') ? 'Relay' : null
          setDetectedInstitution(detection.detected?.institution ?? fallbackInstitution)

          if (shouldAutoSelect) {
            if (detection.suggestedAccountId && detection.confidence >= confidenceThreshold) {
              setAccountId(detection.suggestedAccountId)
              const params = new URLSearchParams(searchParams.toString())
              params.set('account_id', detection.suggestedAccountId)
              router.push(`/upload?${params.toString()}`)
            } else {
              setAccountId('')
              const params = new URLSearchParams(searchParams.toString())
              params.delete('account_id')
              router.push(`/upload?${params.toString()}`)
            }
          }
        } catch (err) {
          if (debugIngest) {
            console.warn('[ingest] Account detection failed', err)
          }
        } finally {
          setDetectionLoading(false)
        }
      }
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
    if (!accountId || !headerFingerprint) return
    let cancelled = false

    const loadMapping = async () => {
      setMappingLoading(true)
      try {
        const result = await apiRequest<{
          mapping: {
            id: string
            mapping: ImportFieldMapping
            amount_strategy: AmountStrategy
            mapping_name?: string | null
          } | null
        }>(
          `/api/import-mappings?account_id=${encodeURIComponent(
            accountId
          )}&header_fingerprint=${encodeURIComponent(headerFingerprint)}`
        )

        if (cancelled) return

        if (result.mapping) {
          setMapping(normalizeImportMapping(result.mapping.mapping))
          setAmountStrategy(result.mapping.amount_strategy)
          setMappingId(result.mapping.id)
          setMappingName(result.mapping.mapping_name ?? '')
          setMappingDirty(false)
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load mapping template'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setMappingLoading(false)
        }
      }
    }

    void loadMapping()

    return () => {
      cancelled = true
    }
  }, [accountId, headerFingerprint])

  useEffect(() => {
    if (!headerSignature) return
    const institution = detectedInstitution?.toLowerCase() === 'relay' ? 'Relay' : null
    if (!institution) return
    let cancelled = false

    const loadProfile = async () => {
      try {
        const result = await apiRequest<{ profile: ImportProfile | null }>(
          `/api/import-profiles?institution=${encodeURIComponent(
            institution
          )}&header_signature=${encodeURIComponent(headerSignature)}`
        )
        if (cancelled) return
        if (result.profile) {
          setImportProfile(result.profile)
          if (!mappingDirty) {
            setMapping(normalizeImportMapping(result.profile.column_map))
            const strategy =
              typeof result.profile.transforms?.amountStrategy === 'string'
                ? (result.profile.transforms.amountStrategy as AmountStrategy)
                : null
            if (strategy) {
              setAmountStrategy(strategy)
            }
            const profileStatusMap =
              (result.profile.status_map as Record<string, string> | null) ?? {}
            setStatusMap(profileStatusMap)
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[ingest] Import profile lookup failed', err)
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [detectedInstitution, headerSignature, mappingDirty])

  useEffect(() => {
    if (!currentImport?.id) return
    if (['succeeded', 'failed', 'canceled'].includes(currentImport.status)) return

    const interval = window.setInterval(() => {
      void fetchImport(currentImport.id)
    }, 2000)

    return () => window.clearInterval(interval)
  }, [currentImport?.id, currentImport?.status])

  const mappingValidation = useMemo(
    () => validateMapping({ mapping, amountStrategy }),
    [mapping, amountStrategy]
  )

  useEffect(() => {
    let cancelled = false

    if (parsedRows.length === 0) {
      setPreviewResult({ transactions: [], errors: [] })
      setPreviewLoading(false)
      return undefined
    }

    const buildPreview = async () => {
      setPreviewLoading(true)
      try {
        const result = await transformImportRows({
          rows: parsedRows,
          mapping,
          amountStrategy,
          accountId: accountId || null,
          sourceSystem: detectedInstitution?.toLowerCase() === 'relay' ? 'relay' : 'manual',
          statusMap: sanitizedStatusMap,
          dateFormat: detectedDateFormat,
        })
        if (!cancelled) {
          setPreviewResult(result)
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to build preview'
          setError(message)
          setPreviewResult({ transactions: [], errors: [] })
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      }
    }

    void buildPreview()

    return () => {
      cancelled = true
    }
  }, [parsedRows, mapping, amountStrategy, accountId, statusMap, detectedInstitution])

  useEffect(() => {
    if (!mapping.status) {
      setStatusValues([])
      setStatusMap({})
      return
    }

    const valueMap = new Map<string, string>()
    for (const row of parsedRows) {
      const raw = row[mapping.status]
      if (!raw) continue
      const trimmed = raw.trim()
      if (!trimmed) continue
      const key = normalizeStatusKey(trimmed)
      if (!valueMap.has(key)) {
        valueMap.set(key, trimmed)
      }
    }

    const values = Array.from(valueMap.entries()).map(([key, value]) => ({
      key,
      value,
    }))
    setStatusValues(values)
    setStatusMap((prev) => {
      const next = { ...prev }
      for (const entry of values) {
        if (!next[entry.key]) {
          next[entry.key] = ''
        }
      }
      return next
    })
  }, [parsedRows, mapping.status])

  const previewErrorSummary = useMemo(() => {
    if (parsedRows.length === 0 || previewResult.errors.length === 0) {
      return null
    }

    const errorRate = previewResult.errors.length / parsedRows.length
    const threshold = 0.1
    if (errorRate < threshold) {
      return null
    }

    const dateErrors = previewResult.errors.filter((error) => error.field === 'date').length
    const amountErrors = previewResult.errors.filter(
      (error) => error.field === 'amount' || error.field === 'inflow'
    ).length

    return {
      errorRate,
      dateErrors,
      amountErrors,
      total: previewResult.errors.length,
    }
  }, [parsedRows.length, previewResult.errors])

  const statusMappingMissing = useMemo(() => {
    if (!mapping.status || statusValues.length === 0) return []
    return statusValues.filter((status) => !statusMap[status.key])
  }, [mapping.status, statusMap, statusValues])

  const detectedDateFormat = useMemo(() => {
    const detected = detectDateFormatFromRows(parsedRows, mapping.date)
    if (detected) return detected
    const profileFormat = importProfile?.transforms?.dateFormat
    if (profileFormat && ['ymd', 'mdy', 'dmy'].includes(String(profileFormat))) {
      return profileFormat as DateFormatHint
    }
    return null
  }, [parsedRows, mapping.date, importProfile])

  const sanitizedStatusMap = useMemo(() => {
    const cleaned: Record<string, StatusMappingValue> = {}
    for (const [key, value] of Object.entries(statusMap)) {
      if (value && value !== '') {
        cleaned[key] = value as StatusMappingValue
      }
    }
    return cleaned
  }, [statusMap])

  const updateMappingField = (field: keyof ImportFieldMapping, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || null,
    }))
    setMappingDirty(true)
  }

  const updateStatusMapping = (key: string, value: string) => {
    setStatusMap((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

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

      if (!headerFingerprint) {
        throw new Error('Header fingerprint is unavailable. Re-parse the file.')
      }

      if (!headerSignature) {
        throw new Error('Header signature is unavailable. Re-parse the file.')
      }

      if (!mappingValidation.isValid) {
        throw new Error(mappingValidation.errors.join(' '))
      }

      if (previewLoading) {
        throw new Error('Preview is still loading. Please wait.')
      }

      if (statusMappingMissing.length > 0) {
        throw new Error('Map all status values before importing.')
      }

      if (previewResult.errors.length > 0 && !skipInvalidRows) {
        throw new Error('Resolve the preflight errors or skip invalid rows before importing.')
      }

      if (previewResult.transactions.length === 0) {
        throw new Error('No valid transactions to import.')
      }

      let mappingTemplateId = mappingId
      if (saveTemplate) {
        const payload = {
          account_id: accountId,
          mapping_name: mappingName || null,
          source: selectedAccount?.institution ?? null,
          header_fingerprint: headerFingerprint,
          mapping: buildMappingPayload(mapping),
          amount_strategy: amountStrategy,
        }

        const result = await apiRequest<{ mapping: { id: string } }>('/api/import-mappings', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        mappingTemplateId = result.mapping.id
        setMappingId(mappingTemplateId)
        setMappingDirty(false)
      } else if (mappingDirty) {
        mappingTemplateId = null
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountId', accountId)
      formData.append('mapping', JSON.stringify(buildMappingPayload(mapping)))
      formData.append('amountStrategy', amountStrategy)
      formData.append('headerFingerprint', headerFingerprint)
      formData.append('canonicalRows', JSON.stringify(previewResult.transactions))
      formData.append('totalRows', String(parsedRows.length))
      formData.append('errorRows', String(previewResult.errors.length))
      formData.append('headerSignature', headerSignature)
      formData.append('statusMap', JSON.stringify(sanitizedStatusMap))
      if (detectedDateFormat) {
        formData.append('dateFormat', detectedDateFormat)
      }
      formData.append(
        'preflight',
        JSON.stringify({
          mapping,
          amountStrategy,
          headerFingerprint,
          headerSignature,
          statusMap: sanitizedStatusMap,
          dateFormat: detectedDateFormat,
          errors: previewResult.errors,
          skippedInvalidRows: skipInvalidRows,
          detectedInstitution,
        })
      )
      formData.append(
        'sourceSystem',
        detectedInstitution?.toLowerCase() === 'relay' ? 'relay' : 'manual'
      )
      if (mappingTemplateId) {
        formData.append('mappingId', mappingTemplateId)
      }
      if (accountSuggestion) {
        formData.append('detection', JSON.stringify(accountSuggestion))
        formData.append(
          'detectionAccepted',
          String(accountSuggestion.suggestedAccountId === accountId)
        )
      }

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
  const importIsActive = ['queued', 'running'].includes(currentImport?.status ?? '')
  const suggestionAccount = accountSuggestion?.suggestedAccountId
    ? accounts.find((account) => account.id === accountSuggestion.suggestedAccountId) ?? null
    : null
  const suggestionConfidenceLabel = accountSuggestion
    ? `${Math.round(accountSuggestion.confidence * 100)}%`
    : null

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
          <option value="">Select account</option>
          {accounts.length === 0 && <option value="">No accounts available</option>}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.institution ? ` · ${account.institution}` : ''}
            </option>
          ))}
        </Select>
        <div className="mt-2 text-xs text-slate-500">
          {detectionLoading && <span>Analyzing statement for account match…</span>}
          {!detectionLoading && accountSuggestion && suggestionAccount && (
            <span>
              Suggested: <span className="font-semibold text-slate-700">{suggestionAccount.name}</span>{' '}
              ({suggestionConfidenceLabel} confidence). {accountSuggestion.reason}
            </span>
          )}
          {!detectionLoading && accountSuggestion && !suggestionAccount && (
            <span>
              No confident account match found. {accountSuggestion.reason}
            </span>
          )}
          {!detectionLoading && !accountSuggestion && (
            <span>Select the bank account that matches this statement.</span>
          )}
        </div>
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
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-2 rounded-full bg-emerald-500 ${importIsActive ? 'w-1/2 animate-pulse' : 'w-full'}`}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {importIsActive
                ? 'Importing transactions. This may take a moment.'
                : 'Import complete.'}
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

      {parsedRows.length > 0 && (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Field mapping</h3>
            <p className="text-xs text-slate-500">
              Match the preview columns to the CSV headers below.
            </p>
          </div>
          {mappingLoading && (
            <span className="text-xs text-slate-400">Loading saved mapping…</span>
          )}
        </div>

          {mappingValidation.errors.length > 0 && (
            <AlertBanner
              variant="error"
              title="Mapping required"
              message={mappingValidation.errors.join(' ')}
            />
          )}

          {previewErrorSummary && (
            <AlertBanner
              variant="info"
              title="Parsing warning"
              message={`We could not parse ${previewErrorSummary.total} rows (${Math.round(
                previewErrorSummary.errorRate * 100
              )}%). Check ${previewErrorSummary.dateErrors} date and ${previewErrorSummary.amountErrors} amount values.`}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount strategy
              </label>
              <Select
                value={amountStrategy}
                onChange={(event) => {
                  setAmountStrategy(event.target.value as AmountStrategy)
                  setMappingDirty(true)
                }}
                className="mt-2 w-full"
              >
                <option value="signed">Signed amount</option>
                <option value="inflow_outflow">Inflow / Outflow</option>
              </Select>
              <p className="mt-2 text-xs text-slate-500">
                Signed amount expects negatives for debits. Inflow/outflow will subtract outflow
                from inflow.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  checked={saveTemplate}
                  onChange={(event) => setSaveTemplate(event.target.checked)}
                />
                <span>
                  Save mapping as template
                  <span className="block text-xs text-slate-500">
                    Reuse this mapping the next time these headers appear.
                  </span>
                </span>
              </label>
              {saveTemplate && (
                <div className="mt-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Template name
                  </label>
                  <input
                    type="text"
                    value={mappingName}
                    onChange={(event) => setMappingName(event.target.value)}
                    placeholder="e.g. Chase business checking"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">More fields</p>
              <p className="text-xs text-slate-500">
                Map optional fields like category, memo, and status.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMoreFields((prev) => !prev)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              aria-expanded={showMoreFields}
            >
              {showMoreFields ? 'Hide' : 'Show'}
            </button>
          </div>

          {showMoreFields && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </label>
                <Select
                  value={mapping.category_name ?? ''}
                  onChange={(event) => updateMappingField('category_name', event.target.value)}
                  className="mt-2 w-full text-xs"
                >
                  <option value="">Select column</option>
                  {parsedHeaders.map((header) => (
                    <option key={`category-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Memo
                </label>
                <Select
                  value={mapping.memo ?? ''}
                  onChange={(event) => updateMappingField('memo', event.target.value)}
                  className="mt-2 w-full text-xs"
                >
                  <option value="">Select column</option>
                  {parsedHeaders.map((header) => (
                    <option key={`memo-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reference
                </label>
                <Select
                  value={mapping.reference ?? ''}
                  onChange={(event) => updateMappingField('reference', event.target.value)}
                  className="mt-2 w-full text-xs"
                >
                  <option value="">Select column</option>
                  {parsedHeaders.map((header) => (
                    <option key={`reference-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <Select
                  value={mapping.status ?? ''}
                  onChange={(event) => updateMappingField('status', event.target.value)}
                  className="mt-2 w-full text-xs"
                >
                  <option value="">Select column</option>
                  {parsedHeaders.map((header) => (
                    <option key={`status-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {mapping.status && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Status mapping</p>
                <p className="text-xs text-slate-500">
                  Map each CSV status to pending, posted, reconciled, or ignore.
                </p>
              </div>
              {statusValues.length === 0 && (
                <p className="text-xs text-slate-500">No status values detected yet.</p>
              )}
              {statusValues.length > 0 && statusMappingMissing.length > 0 && (
                <AlertBanner
                  variant="error"
                  title="Status mapping required"
                  message="Every status value must be mapped or ignored before import."
                />
              )}
              {statusValues.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {statusValues.map((status) => (
                    <label
                      key={status.key}
                      className="flex flex-col gap-2 text-xs text-slate-600"
                    >
                      <span className="font-semibold text-slate-700">{status.value}</span>
                      <Select
                        value={statusMap[status.key] ?? ''}
                        onChange={(event) => updateStatusMapping(status.key, event.target.value)}
                        className="w-full text-xs"
                      >
                        <option value="">Select mapping</option>
                        {ALLOWED_POSTING_STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value="ignore">Ignore (store raw only)</option>
                      </Select>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {parsedRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                {previewLoading
                  ? 'Building preview'
                  : `Parsed ${previewResult.transactions.length} transactions`}
              </h3>
              <p className="text-xs text-slate-500">Review the preview before importing.</p>
            </div>
            <Button
              onClick={handleUpload}
              disabled={
                uploading ||
                !accountId ||
                !mappingValidation.isValid ||
                previewLoading ||
                previewResult.transactions.length === 0 ||
                (previewResult.errors.length > 0 && !skipInvalidRows) ||
                statusMappingMissing.length > 0 ||
                ['queued', 'running'].includes(currentImport?.status ?? '')
              }
              variant="primary"
            >
              {uploading ? 'Importing...' : 'Import transactions'}
            </Button>
          </div>

          {previewResult.errors.length > 0 && (
            <AlertBanner
              variant="error"
              title="Preflight errors detected"
              message={`We found ${previewResult.errors.length} issues. Resolve them or skip invalid rows to proceed.`}
            />
          )}

          {previewResult.errors.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={skipInvalidRows}
                onChange={(event) => setSkipInvalidRows(event.target.checked)}
              />
              Skip invalid rows and import the rest.
            </label>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <div className="space-y-2">
                        <span>Date</span>
                        <Select
                          value={mapping.date ?? ''}
                          onChange={(event) => updateMappingField('date', event.target.value)}
                          className="w-full text-xs"
                        >
                          <option value="">Select column</option>
                          {parsedHeaders.map((header) => (
                            <option key={`date-${header}`} value={header}>
                              {header}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="space-y-2">
                        <span>Payee</span>
                        <Select
                          value={mapping.payee ?? ''}
                          onChange={(event) => updateMappingField('payee', event.target.value)}
                          className="w-full text-xs"
                        >
                          <option value="">Select column</option>
                          {parsedHeaders.map((header) => (
                            <option key={`payee-${header}`} value={header}>
                              {header}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="space-y-2">
                        <span>Description</span>
                        <Select
                          value={mapping.description ?? ''}
                          onChange={(event) =>
                            updateMappingField('description', event.target.value)
                          }
                          className="w-full text-xs"
                        >
                          <option value="">Select column</option>
                          {parsedHeaders.map((header) => (
                            <option key={`description-${header}`} value={header}>
                              {header}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="space-y-2">
                        <span>Category</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <div className="space-y-2">
                        <span className="block text-left">Amount</span>
                        {amountStrategy === 'signed' ? (
                          <Select
                            value={mapping.amount ?? ''}
                            onChange={(event) => updateMappingField('amount', event.target.value)}
                            className="w-full text-xs"
                          >
                            <option value="">Select column</option>
                            {parsedHeaders.map((header) => (
                              <option key={`amount-${header}`} value={header}>
                                {header}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <div className="space-y-2">
                            <Select
                              value={mapping.inflow ?? ''}
                              onChange={(event) => updateMappingField('inflow', event.target.value)}
                              className="w-full text-xs"
                            >
                              <option value="">Inflow column</option>
                              {parsedHeaders.map((header) => (
                                <option key={`inflow-${header}`} value={header}>
                                  {header}
                                </option>
                              ))}
                            </Select>
                            <Select
                              value={mapping.outflow ?? ''}
                              onChange={(event) =>
                                updateMappingField('outflow', event.target.value)
                              }
                              className="w-full text-xs"
                            >
                              <option value="">Outflow column</option>
                              {parsedHeaders.map((header) => (
                                <option key={`outflow-${header}`} value={header}>
                                  {header}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {previewResult.transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        No preview rows yet. Adjust the mapping to continue.
                      </td>
                    </tr>
                  ) : (
                    previewResult.transactions.slice(0, 50).map((transaction) => (
                      <tr
                        key={transaction.import_row_hash}
                        className="border-b border-slate-100 text-sm text-slate-700"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                          {transaction.date}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {transaction.payee}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {transaction.description ?? 'No description'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {transaction.category_name ?? ''}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm font-semibold text-right whitespace-nowrap ${
                            transaction.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {previewResult.transactions.length > 50 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  Showing first 50 of {previewResult.transactions.length} transactions
                </p>
              </div>
            )}
          </div>
          {previewResult.errors.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              <p className="font-semibold">Row-level issues</p>
              <ul className="mt-2 space-y-1">
                {previewResult.errors.slice(0, 10).map((issue, idx) => (
                  <li key={`${issue.rowNumber}-${issue.field}-${idx}`}>
                    Row {issue.rowNumber}: {issue.message}
                  </li>
                ))}
              </ul>
              {previewResult.errors.length > 10 && (
                <p className="mt-2 text-rose-600">
                  Showing first 10 of {previewResult.errors.length} issues.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
