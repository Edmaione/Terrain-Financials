import { describe, expect, it } from 'vitest'
import { normalizeTransactionFilters } from '@/lib/transaction-filters'

describe('normalizeTransactionFilters', () => {
  it('normalizes enum filters and trims search input', () => {
    const result = normalizeTransactionFilters({
      reviewStatus: 'approved',
      bankStatus: 'all',
      reconciliationStatus: 'cleared',
      sourceSystem: 'manual',
      search: '  Vendor  ',
    })

    expect(result).toMatchObject({
      reviewStatus: 'approved',
      bankStatus: null,
      reconciliationStatus: 'cleared',
      sourceSystem: 'manual',
      search: 'Vendor',
    })
  })

  it('parses numeric ranges and ignores invalid numbers', () => {
    const result = normalizeTransactionFilters({
      amountMin: '100.25',
      amountMax: 'not-a-number',
    })

    expect(result.amountMin).toBe(100.25)
    expect(result.amountMax).toBeNull()
  })
})
