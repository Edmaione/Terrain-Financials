import { describe, expect, it } from 'vitest'
import { planCsvImport, PreparedCsvTransaction } from '@/lib/import-idempotency'

describe('planCsvImport', () => {
  it('treats repeat imports as updates', () => {
    const incoming: PreparedCsvTransaction[] = [
      {
        transaction: {
          source: 'manual',
          source_id: 'ABC-123',
          source_hash: 'hash-one',
        },
        splits: [],
      },
    ]

    const firstPass = planCsvImport(incoming, [])
    expect(firstPass.inserts).toHaveLength(1)
    expect(firstPass.updates).toHaveLength(0)

    const existing = [
      {
        id: 'txn-1',
        source: 'manual',
        source_id: 'ABC-123',
        source_hash: 'hash-one',
      },
    ]

    const secondPass = planCsvImport(incoming, existing)
    expect(secondPass.inserts).toHaveLength(0)
    expect(secondPass.updates).toHaveLength(1)
  })

  it('prefers source_id matches before source_hash', () => {
    const incoming: PreparedCsvTransaction[] = [
      {
        transaction: {
          source: 'relay',
          source_id: 'SOURCE-1',
          source_hash: 'hash-two',
        },
        splits: [],
      },
    ]

    const existing = [
      {
        id: 'txn-2',
        source: 'relay',
        source_id: 'SOURCE-1',
        source_hash: 'hash-old',
      },
      {
        id: 'txn-3',
        source: 'relay',
        source_id: null,
        source_hash: 'hash-two',
      },
    ]

    const plan = planCsvImport(incoming, existing)
    expect(plan.updates[0]?.id).toBe('txn-2')
  })
})
