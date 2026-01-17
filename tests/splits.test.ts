import { describe, expect, it } from 'vitest'
import { assertBalancedSplits } from '@/lib/ledger'

describe('assertBalancedSplits', () => {
  it('allows balanced splits', () => {
    expect(() => assertBalancedSplits([{ amount: 125 }, { amount: -125 }])).not.toThrow()
  })

  it('rejects zero-amount splits', () => {
    expect(() => assertBalancedSplits([{ amount: 0 }, { amount: 100 }, { amount: -100 }])).toThrow(
      'Split amount cannot be zero.'
    )
  })

  it('rejects unbalanced splits', () => {
    expect(() => assertBalancedSplits([{ amount: 100 }, { amount: -90 }])).toThrow(
      'Splits must balance to zero.'
    )
  })
})
