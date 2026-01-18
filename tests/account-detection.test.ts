import { describe, expect, it } from 'vitest'
import { detectAccountFromCsv } from '@/lib/account-detection'

describe('account detection', () => {
  it('prefers learned mapping matches', () => {
    const csvText = `Date,Description,Amount\n2024-01-01,Test,-10\n`
    const result = detectAccountFromCsv({
      csvText,
      accounts: [
        { id: 'acct-1', name: 'Checking', institution: 'Chase', account_number: '1234' },
      ],
      mappings: [
        {
          id: 'map-1',
          account_id: 'acct-1',
          header_signature: 'sig-123',
          institution: null,
          statement_account_name: null,
          account_number: null,
          account_last4: null,
        },
      ],
      headerSignature: 'sig-123',
    })

    expect(result.suggestedAccountId).toBe('acct-1')
    expect(result.method).toBe('mapping_table')
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it('matches account last4 from header context', () => {
    const csvText = `Account ending in 1835,Date,Description,Amount\n2024-01-01,Test,-10\n`
    const result = detectAccountFromCsv({
      csvText,
      accounts: [
        {
          id: 'acct-2',
          name: 'Citi Checking',
          institution: 'Citi',
          last4: '1835',
        },
      ],
      headerSignature: 'sig-456',
    })

    expect(result.suggestedAccountId).toBe('acct-2')
    expect(result.method).toBe('header_match')
    expect(result.confidence).toBeGreaterThanOrEqual(0.75)
  })
})
