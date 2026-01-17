import { describe, expect, it } from 'vitest'
import { computeHeaderFingerprint, normalizeHeaders } from '@/lib/import-header-fingerprint'

describe('import header fingerprint', () => {
  it('normalizes headers and produces stable fingerprints', async () => {
    const headers = [' Transaction Date ', 'Amount ($)', 'Payee/Name']
    const reordered = ['Amount ($)', ' Transaction Date ', 'Payee/Name']

    expect(normalizeHeaders(headers)).toEqual(['transaction_date', 'amount', 'payeename'])

    const first = await computeHeaderFingerprint(headers)
    const second = await computeHeaderFingerprint(headers)
    const changed = await computeHeaderFingerprint([...headers, 'Memo'])
    const reorderedFingerprint = await computeHeaderFingerprint(reordered)

    expect(first).toBe(second)
    expect(changed).not.toBe(first)
    expect(reorderedFingerprint).not.toBe(first)
  })
})
