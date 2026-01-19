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

type TransactionStatusValidationResult = { ok: true } | { ok: false; error: string }

export function validateTransactionStatusPayload(
  payload: Record<string, unknown>
): TransactionStatusValidationResult {
  if (!Object.prototype.hasOwnProperty.call(payload, 'status')) {
    return { ok: true }
  }

  const { status } = payload

  if (status === null || status === undefined) {
    return { ok: true }
  }

  if (!isAllowedTransactionStatus(status)) {
    return {
      ok: false,
      error: `Invalid transaction status "${String(
        status
      )}". Allowed values: ${ALLOWED_TRANSACTION_STATUSES.join(', ')}.`,
    }
  }

  return { ok: true }
}
