import { PostingStatus } from '@/types'

export const ALLOWED_POSTING_STATUSES: PostingStatus[] = [
  'pending',
  'posted',
  'reconciled',
]

export type StatusMappingValue = PostingStatus | 'ignore'

export function normalizeStatusKey(value?: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

export function mapStatusValue(
  rawValue: string | null | undefined,
  statusMap: Record<string, StatusMappingValue> | null | undefined
): PostingStatus | null {
  if (!rawValue) return null
  if (!statusMap) return null
  const key = normalizeStatusKey(rawValue)
  const mapped = statusMap[key]
  if (!mapped || mapped === 'ignore') return null
  return mapped
}
