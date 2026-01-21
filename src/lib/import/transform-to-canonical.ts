import {
  AmountStrategy,
  BankStatus,
  CSVRow,
  ImportFieldMapping,
  ParsedTransaction,
  ReconciliationStatus,
} from '@/types'
import { type DateFormatHint } from '@/lib/import-date-format'
import { resolveStatusValue, type StatusMappingValue } from '@/lib/import-status'
import { isUuid } from '@/lib/uuid'

export type TransformError = {
  rowNumber: number
  field: 'date' | 'amount' | 'inflow' | 'outflow' | 'payee' | 'status'
  message: string
  rawRow?: CSVRow
}

export type TransformIssue = {
  rowNumber: number
  field: 'status' | 'category'
  severity: 'warning' | 'error'
  message: string
  rawRow?: CSVRow
}

export type CanonicalImportRow = ParsedTransaction & {
  rowNumber: number
  reviewed: boolean
  import_id: string | null
  import_row_hash: string
  account_id?: string | null
  // AI suggestion fields (populated from preview categorization)
  ai_suggested_category?: string | null
  ai_suggested_category_name?: string | null
  ai_confidence?: number
  ai_source?: 'rule' | 'ai' | 'pattern'
  ai_rule_id?: string | null
}

function normalizeValue(value?: string | null): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseDate(dateStr: string, dateFormat?: DateFormatHint | null): string {
  const parsed = new Date(dateStr)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }

  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const [first, second, year] = parts
    if (dateFormat === 'dmy') {
      return `${year}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`
    }
    return `${year}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`
  }

  throw new Error(`Unable to parse date: ${dateStr}`)
}

function parseAmount(amountStr: string): number {
  let cleaned = amountStr.replace(/[$,\s]/g, '')
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = `-${cleaned.slice(1, -1)}`
  }

  const parsed = Number.parseFloat(cleaned)
  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to parse amount: ${amountStr}`)
  }

  return parsed
}

function readMappedValue(row: CSVRow, key: string | null) {
  if (!key) return null
  return row[key]
}

async function sha256Hex(payload: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  const { createHash } = await import('crypto')
  return createHash('sha256').update(payload).digest('hex')
}

function buildImportRowHashPayload({
  rowNumber,
  date,
  payee,
  description,
  memo,
  amount,
  reference,
  status,
  source_system,
}: {
  rowNumber: number
  date: string
  payee: string
  description: string | null
  memo: string | null
  amount: number
  reference: string | null
  status: BankStatus | null
  source_system: ParsedTransaction['source_system']
}) {
  return JSON.stringify({
    rowNumber,
    date,
    payee: payee.trim().toLowerCase(),
    description: description ?? '',
    memo: memo ?? '',
    amount,
    reference: reference ?? '',
    status,
    source_system: source_system ?? 'manual',
  })
}

export async function transformImportRows({
  rows,
  mapping,
  amountStrategy,
  sourceSystem = 'manual',
  accountId,
  importId,
  statusMap,
  dateFormat,
  flipSigns = false,
}: {
  rows: CSVRow[]
  mapping: ImportFieldMapping
  amountStrategy: AmountStrategy
  sourceSystem?: ParsedTransaction['source_system']
  accountId?: string | null
  importId?: string | null
  statusMap?: Record<string, StatusMappingValue> | null
  dateFormat?: DateFormatHint | null
  flipSigns?: boolean
}): Promise<{
  transactions: CanonicalImportRow[]
  errors: TransformError[]
  issues: TransformIssue[]
}> {
  const errors: TransformError[] = []
  const issues: TransformIssue[] = []
  const transactions: CanonicalImportRow[] = []

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1
    const dateRaw = normalizeValue(readMappedValue(row, mapping.date))
    if (!dateRaw) {
      errors.push({ rowNumber, field: 'date', message: 'Date value is missing.', rawRow: row })
      continue
    }

    let date: string
    try {
      date = parseDate(dateRaw, dateFormat)
    } catch (error) {
      errors.push({
        rowNumber,
        field: 'date',
        message: error instanceof Error ? error.message : 'Unable to parse date.',
        rawRow: row,
      })
      continue
    }

    let amount = 0
    try {
      if (amountStrategy === 'signed') {
        const amountRaw = normalizeValue(readMappedValue(row, mapping.amount))
        if (!amountRaw) {
          throw new Error('Amount value is missing.')
        }
        amount = parseAmount(amountRaw)
      } else {
        const inflowRaw = normalizeValue(readMappedValue(row, mapping.inflow))
        const outflowRaw = normalizeValue(readMappedValue(row, mapping.outflow))

        const inflow = inflowRaw ? parseAmount(inflowRaw) : 0
        const outflow = outflowRaw ? parseAmount(outflowRaw) : 0
        amount = inflow - outflow
      }
      // Flip signs for credit card statements (where purchases are positive)
      if (flipSigns) {
        amount = -amount
      }
    } catch (error) {
      errors.push({
        rowNumber,
        field: amountStrategy === 'signed' ? 'amount' : 'inflow',
        message: error instanceof Error ? error.message : 'Unable to parse amount.',
        rawRow: row,
      })
      continue
    }

    const payee = normalizeValue(readMappedValue(row, mapping.payee))
    const description = normalizeValue(readMappedValue(row, mapping.description))
    const memo = normalizeValue(readMappedValue(row, mapping.memo))
    const reference = normalizeValue(readMappedValue(row, mapping.reference))
    const rawCategory = normalizeValue(readMappedValue(row, mapping.category))
    const category = rawCategory && isUuid(rawCategory) ? rawCategory : null
    if (rawCategory && !category) {
      issues.push({
        rowNumber,
        field: 'category',
        severity: 'warning',
        message: `Category value "${rawCategory}" is not a valid internal category ID.`,
        rawRow: row,
      })
    }
    const resolvedDescription = description ?? memo ?? reference ?? payee ?? null
    const resolvedPayee = payee ?? resolvedDescription ?? 'Unknown'
    if (!payee && !description) {
      errors.push({
        rowNumber,
        field: 'payee',
        message: 'Payee or description is required.',
        rawRow: row,
      })
      continue
    }
    const rawStatus = normalizeValue(readMappedValue(row, mapping.bank_status))
    const { value: statusValue, issue: statusIssue } = resolveStatusValue(rawStatus, statusMap)
    if (statusIssue) {
      issues.push({
        rowNumber,
        field: 'status',
        severity: 'warning',
        message: statusIssue,
        rawRow: row,
      })
    }
    const bankStatus: BankStatus | null =
      statusValue === 'pending' || statusValue === 'posted' ? statusValue : null
    const reconciliationStatus: ReconciliationStatus | null =
      statusValue === 'unreconciled' || statusValue === 'cleared' || statusValue === 'reconciled'
        ? statusValue
        : null
    const importRowHash = await sha256Hex(
      buildImportRowHashPayload({
        rowNumber,
        date,
        payee: resolvedPayee,
        description: resolvedDescription,
        memo,
        amount,
        reference,
        status: bankStatus,
        source_system: sourceSystem,
      })
    )

    transactions.push({
      date,
      payee: resolvedPayee,
      description: resolvedDescription,
      memo,
      amount,
      category,
      reference,
      bank_status: bankStatus,
      reconciliation_status: reconciliationStatus,
      bank_status_raw: rawStatus,
      source_system: sourceSystem,
      raw_data: row,
      rowNumber,
      reviewed: false,
      import_id: importId ?? null,
      import_row_hash: importRowHash,
      account_id: accountId ?? null,
    })
  }

  return { transactions, errors, issues }
}
