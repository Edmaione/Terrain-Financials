import { BankStatus, ReconciliationStatus } from '@/types'

export type ImportStatusValue = BankStatus | ReconciliationStatus

export const ALLOWED_POSTING_STATUSES: ImportStatusValue[] = [
  'pending',
  'posted',
  'cleared',
  'reconciled',
]

export type StatusMappingValue = ImportStatusValue | 'ignore'

export function normalizeStatusKey(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

const FALLBACK_STATUS_MAP: Record<string, ImportStatusValue> = {
  pending: 'pending',
  posted: 'posted',
  complete: 'posted',
  completed: 'posted',
  settled: 'posted',
  cleared: 'cleared',
  reconciled: 'reconciled',
  unreconciled: 'unreconciled',
}

export function resolveStatusValue(
  rawValue: string | null | undefined,
  statusMap: Record<string, StatusMappingValue> | null | undefined
): { value: ImportStatusValue | null; issue?: string } {
  if (!rawValue) return { value: null }
  const key = normalizeStatusKey(rawValue)
  if (statusMap && Object.prototype.hasOwnProperty.call(statusMap, key)) {
    const mapped = statusMap[key]
    if (!mapped || mapped === 'ignore') {
      return { value: null }
    }
    return { value: mapped }
  }

  const fallback = FALLBACK_STATUS_MAP[key]
  if (fallback) {
    return { value: fallback }
  }

  return {
    value: 'posted',
    issue: `Status "${rawValue}" is not recognized; defaulted to "posted".`,
  }
}
