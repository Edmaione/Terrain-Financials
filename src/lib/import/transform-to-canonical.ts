import {
  AmountStrategy,
  CSVRow,
  ImportFieldMapping,
  ParsedTransaction,
  PostingStatus,
} from '@/types'
import { type DateFormatHint } from '@/lib/import-date-format'
import { mapStatusValue, normalizeStatusKey, type StatusMappingValue } from '@/lib/import-status'

export type TransformError = {
  rowNumber: number
  field: 'date' | 'amount' | 'inflow' | 'outflow' | 'payee' | 'status'
  message: string
}

export type CanonicalImportRow = ParsedTransaction & {
  rowNumber: number
  reviewed: boolean
  import_id: string | null
  import_row_hash: string
  account_id?: string | null
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
  status: PostingStatus | null
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
}: {
  rows: CSVRow[]
  mapping: ImportFieldMapping
  amountStrategy: AmountStrategy
  sourceSystem?: ParsedTransaction['source_system']
  accountId?: string | null
  importId?: string | null
  statusMap?: Record<string, StatusMappingValue> | null
  dateFormat?: DateFormatHint | null
}): Promise<{ transactions: CanonicalImportRow[]; errors: TransformError[] }> {
  const errors: TransformError[] = []
  const transactions: CanonicalImportRow[] = []

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1
    const dateRaw = normalizeValue(readMappedValue(row, mapping.date))
    if (!dateRaw) {
      errors.push({ rowNumber, field: 'date', message: 'Date value is missing.' })
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
    } catch (error) {
      errors.push({
        rowNumber,
        field: amountStrategy === 'signed' ? 'amount' : 'inflow',
        message: error instanceof Error ? error.message : 'Unable to parse amount.',
      })
      continue
    }

    const payee = normalizeValue(readMappedValue(row, mapping.payee))
    const description = normalizeValue(readMappedValue(row, mapping.description))
    const memo = normalizeValue(readMappedValue(row, mapping.memo))
    const reference = normalizeValue(readMappedValue(row, mapping.reference))
    const category_name = normalizeValue(readMappedValue(row, mapping.category_name))
    const resolvedDescription = description ?? memo ?? reference ?? payee ?? null
    const resolvedPayee = payee ?? resolvedDescription ?? 'Unknown'
    if (!payee && !description) {
      errors.push({
        rowNumber,
        field: 'payee',
        message: 'Payee or description is required.',
      })
      continue
    }
    const rawStatus = normalizeValue(readMappedValue(row, mapping.status))
    const status = mapStatusValue(rawStatus, statusMap)
    if (rawStatus && mapping.status) {
      const normalizedStatus = normalizeStatusKey(rawStatus)
      if (!statusMap || !statusMap[normalizedStatus]) {
        errors.push({
          rowNumber,
          field: 'status',
          message: `Status "${rawStatus}" is not mapped.`,
        })
        continue
      }
    }
    const importRowHash = await sha256Hex(
      buildImportRowHashPayload({
        rowNumber,
        date,
        payee: resolvedPayee,
        description: resolvedDescription,
        memo,
        amount,
        reference,
        status,
        source_system: sourceSystem,
      })
    )

    transactions.push({
      date,
      payee: resolvedPayee,
      description: resolvedDescription,
      memo,
      amount,
      category_name,
      reference,
      status,
      status_raw: rawStatus,
      source_system: sourceSystem,
      raw_data: row,
      rowNumber,
      reviewed: false,
      import_id: importId ?? null,
      import_row_hash: importRowHash,
      account_id: accountId ?? null,
    })
  }

  return { transactions, errors }
}
