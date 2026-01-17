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

export function computeSourceHash(payload: Record<string, unknown>) {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort())
  return createHash('sha256').update(normalized).digest('hex')
}

export function isReviewApproved(reviewStatus?: ReviewStatus | null, reviewed?: boolean | null) {
  if (reviewStatus) {
    return reviewStatus === 'approved'
  }
  return Boolean(reviewed)
}
