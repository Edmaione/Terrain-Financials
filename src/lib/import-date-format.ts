import { CSVRow } from '@/types'

export type DateFormatHint = 'ymd' | 'mdy' | 'dmy'

export function detectDateFormat(value: string): DateFormatHint | null {
  const trimmed = value.trim()
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    return 'ymd'
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
    const [first, second] = trimmed.split('/')
    const firstNum = Number.parseInt(first, 10)
    const secondNum = Number.parseInt(second, 10)
    if (firstNum > 12 && secondNum <= 12) {
      return 'dmy'
    }
    if (secondNum > 12 && firstNum <= 12) {
      return 'mdy'
    }
    return 'mdy'
  }
  return null
}

export function detectDateFormatFromRows(
  rows: CSVRow[],
  dateColumn: string | null,
  sampleSize = 25
): DateFormatHint | null {
  if (!dateColumn) return null
  const samples = rows.slice(0, sampleSize)
  for (const row of samples) {
    const value = row[dateColumn]
    if (!value) continue
    const format = detectDateFormat(value)
    if (format) {
      return format
    }
  }
  return null
}
