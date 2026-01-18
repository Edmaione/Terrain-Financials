import { describe, expect, it, vi } from 'vitest'
import { detectAndPairTransfers } from '@/lib/categorization-engine'

const fromMock = vi.fn()
const selectMock = vi.fn()
const updateMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => fromMock(table),
  },
}))

type SelectChain = {
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
}

function buildSelectChain(result: unknown[]): SelectChain {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn(),
  }
  chain.is
    .mockImplementationOnce(() => chain)
    .mockImplementationOnce(() => Promise.resolve({ data: result, error: null }))
  return chain
}

describe('detectAndPairTransfers', () => {
  it('pairs opposite-amount transactions into a transfer group', async () => {
    const sourceTransactions = [
      { id: 'txn-1', amount: -50, account_id: 'acc-1', transfer_group_id: null, is_transfer: false },
    ]
    const candidateTransactions = [
      { id: 'txn-2', amount: 50, account_id: 'acc-2', transfer_group_id: null, is_transfer: false },
    ]

    selectMock
      .mockImplementationOnce(() => buildSelectChain(sourceTransactions))
      .mockImplementationOnce(() => buildSelectChain(candidateTransactions))

    const updatePayloads: Array<Record<string, unknown>> = []
    updateMock.mockImplementation((payload: Record<string, unknown>) => {
      updatePayloads.push(payload)
      return {
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    fromMock.mockImplementation((table: string) => {
      if (table === 'transactions') {
        return {
          select: selectMock,
          update: updateMock,
        }
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const paired = await detectAndPairTransfers('acc-1', '2024-02-01')

    expect(paired).toEqual([{ source_id: 'txn-1', paired_id: 'txn-2' }])
    expect(updatePayloads).toHaveLength(2)
    const [first, second] = updatePayloads
    expect(first).toMatchObject({
      is_transfer: true,
      transfer_to_account_id: 'acc-2',
    })
    expect(second).toMatchObject({
      is_transfer: true,
      transfer_to_account_id: 'acc-1',
    })
    expect(first.transfer_group_id).toBeDefined()
    expect(first.transfer_group_id).toEqual(second.transfer_group_id)
  })
})
