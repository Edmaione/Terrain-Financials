import { describe, expect, it } from 'vitest'
import { resolveTransactionFields } from '@/lib/csv-importer'
import type { ParsedTransaction } from '@/types'

describe('resolveTransactionFields', () => {
  it('falls back to payee when no description, memo, or reference is present', () => {
    const transaction: ParsedTransaction = {
      date: '2024-01-02',
      payee: 'Acme Supplies',
      amount: -42.5,
      raw_data: {},
    }

    const result = resolveTransactionFields(transaction)

    expect(result.description).toBe('Acme Supplies')
  })

  it('prioritizes description, then memo, then reference', () => {
    const transaction: ParsedTransaction = {
      date: '2024-01-03',
      payee: 'Fallback Payee',
      description: '   ',
      memo: 'Memo wins',
      reference: 'Ref loses',
      amount: 20,
      raw_data: {},
    }

    const result = resolveTransactionFields(transaction)

    expect(result.description).toBe('Memo wins')
  })
})
