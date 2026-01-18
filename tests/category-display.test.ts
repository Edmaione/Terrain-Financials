import { describe, expect, it } from 'vitest'
import { normalizeExternalCategoryLabel } from '@/lib/category-mappings'
import { getCategoryDisplayLabel, NEEDS_CATEGORIZATION_LABEL } from '@/lib/transactions'

describe('normalizeExternalCategoryLabel', () => {
  it('normalizes casing and whitespace', () => {
    expect(normalizeExternalCategoryLabel('  Office   Supplies ')).toBe('office supplies')
  })

  it('returns null for empty labels', () => {
    expect(normalizeExternalCategoryLabel('   ')).toBeNull()
    expect(normalizeExternalCategoryLabel(null)).toBeNull()
  })
})

describe('getCategoryDisplayLabel', () => {
  it('prefers internal category name when present', () => {
    expect(
      getCategoryDisplayLabel({
        category_id: 'cat-1',
        category: { name: 'Travel' },
      })
    ).toBe('Travel')
  })

  it('defaults to needs categorization when both are missing', () => {
    expect(getCategoryDisplayLabel({})).toBe(NEEDS_CATEGORIZATION_LABEL)
  })
})
