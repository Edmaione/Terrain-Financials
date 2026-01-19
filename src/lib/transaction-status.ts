import { TransactionStatus } from '@/types'

export const ALLOWED_TRANSACTION_STATUSES: TransactionStatus[] = [
  'pending',
  'posted',
  'reconciled',
]

export function isAllowedTransactionStatus(value: unknown): value is TransactionStatus {
  return (
    typeof value === 'string' &&
    ALLOWED_TRANSACTION_STATUSES.includes(value as TransactionStatus)
  )
}

export function assertValidTransactionStatus(value: unknown) {
  if (value === null || value === undefined) return
  if (!isAllowedTransactionStatus(value)) {
    throw new Error(
      `Invalid transaction status "${String(
        value
      )}". Allowed values: ${ALLOWED_TRANSACTION_STATUSES.join(', ')}.`
    )
  }
}

export function validateTransactionStatusPayload(payload: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(payload, 'status')) return
  assertValidTransactionStatus(payload.status)
}
