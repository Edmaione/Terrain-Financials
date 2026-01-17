import { createHash } from 'crypto'

export type TxnStatus = 'draft' | 'posted' | 'void'
export type ReviewStatus = 'needs_review' | 'approved'
export type SourceSystem =
  | 'manual'
  | 'relay'
  | 'stripe'
  | 'gusto'
  | 'amex'
  | 'us_bank'
  | 'citi'
  | 'dcu'
  | 'sheffield'
  | 'other'
export type AccountClass = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export type NormalBalance = 'debit' | 'credit'

export interface Payee {
  id: string
  name: string
  display_name?: string | null
  created_at: string
  updated_at: string
}

export interface ImportBatch {
  id: string
  source: SourceSystem
  source_id?: string | null
  file_name?: string | null
  metadata?: Record<string, unknown> | null
  created_by?: string | null
  imported_at: string
  created_at: string
  updated_at: string
}

export interface ReviewAction {
  id: string
  transaction_id: string
  action: 'approve' | 'reclass'
  before_json?: Record<string, unknown> | null
  after_json?: Record<string, unknown> | null
  actor?: string | null
  created_at: string
}

export interface TransactionSplit {
  id: string
  transaction_id: string
  account_id?: string | null
  category_id?: string | null
  amount: number
  memo?: string | null
  created_at: string
  updated_at: string
}

export function normalizePayeeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

type NormalizedValue =
  | string
  | number
  | boolean
  | null
  | NormalizedValue[]
  | { [key: string]: NormalizedValue }

function normalizeForHash(value: unknown): NormalizedValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    return value.trim().replace(/\s+/g, ' ')
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForHash(entry))
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))

    const normalized: Record<string, NormalizedValue> = {}
    entries.forEach(([key, entryValue]) => {
      normalized[key] = normalizeForHash(entryValue)
    })
    return normalized
  }
  return null
}

export function computeSourceHash(payload: Record<string, unknown>) {
  const normalized = normalizeForHash(payload)
  const serialized = JSON.stringify(normalized)
  return createHash('sha256').update(serialized).digest('hex')
}

export function assertBalancedSplits(splits: Array<{ amount: number }>) {
  if (!splits || splits.length === 0) return

  let totalCents = 0
  splits.forEach((split) => {
    if (!Number.isFinite(split.amount)) {
      throw new Error('Split amount must be a finite number.')
    }
    const cents = Math.round(split.amount * 100)
    if (cents === 0) {
      throw new Error('Split amount cannot be zero.')
    }
    totalCents += cents
  })

  if (totalCents !== 0) {
    throw new Error('Splits must balance to zero.')
  }
}

export function isReviewApproved(reviewStatus?: ReviewStatus | null, reviewed?: boolean | null) {
  if (reviewStatus) {
    return reviewStatus === 'approved'
  }
  return Boolean(reviewed)
}
