export function normalizeExternalCategoryLabel(label?: string | null): string | null {
  if (!label) return null
  const normalized = label.trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized === '' ? null : normalized
}
