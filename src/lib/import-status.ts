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

export function mapStatusValue(
  rawValue: string | null | undefined,
  statusMap: Record<string, StatusMappingValue> | null | undefined
): ImportStatusValue | null {
  if (!rawValue) return null
  if (!statusMap) return null
  const key = normalizeStatusKey(rawValue)
  const mapped = statusMap[key]
  if (!mapped || mapped === 'ignore') return null
  return mapped
}
