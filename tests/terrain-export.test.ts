import { describe, expect, it, vi } from 'vitest'
import { exportTerrainJournalLines } from '@/lib/terrain-export'

const fromMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => fromMock(table),
  },
}))

describe('exportTerrainJournalLines', () => {
  it('returns deterministic ordering and stable line ids', async () => {
    const transactions = [
      {
        id: 'txn-b',
        date: '2024-01-02',
        amount: 50,
        description: 'Second',
        payee: 'B',
        payee_original: 'B',
        payee_display: 'B',
        source: 'manual',
        source_id: 'src-b',
        approved_by: 'tester',
        approved_at: '2024-01-03',
        review_status: 'approved',
        reviewed: true,
        is_split: false,
        primary_category_id: 'cat-1',
        category_id: null,
        account_id: 'acc-1',
      },
      {
        id: 'txn-a',
        date: '2024-01-02',
        amount: 100,
        description: 'First',
        payee: 'A',
        payee_original: 'A',
        payee_display: 'A',
        source: 'manual',
        source_id: 'src-a',
        approved_by: 'tester',
        approved_at: '2024-01-03',
        review_status: 'approved',
        reviewed: true,
        is_split: true,
        primary_category_id: null,
        category_id: null,
        account_id: 'acc-1',
      },
    ]

    const splits = [
      {
        id: 'split-2',
        transaction_id: 'txn-a',
        amount: -40,
        memo: 'Part B',
        account_id: 'acc-2',
        category_id: null,
      },
      {
        id: 'split-1',
        transaction_id: 'txn-a',
        amount: 40,
        memo: 'Part A',
        account_id: 'acc-1',
        category_id: null,
      },
    ]

    const accounts = [
      { id: 'acc-1', name: 'Cash', terrain_account_code: '1000' },
      { id: 'acc-2', name: 'Liability', terrain_account_code: '2000' },
    ]

    const categories = [{ id: 'cat-1', name: 'Expense', terrain_category_code: '5000' }]

    fromMock.mockImplementation((table: string) => {
      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: transactions, error: null }),
        }
      }

      if (table === 'transaction_splits') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: splits, error: null }),
          }),
        }
      }

      if (table === 'accounts') {
        return {
          select: vi.fn().mockResolvedValue({ data: accounts, error: null }),
        }
      }

      if (table === 'categories') {
        return {
          select: vi.fn().mockResolvedValue({ data: categories, error: null }),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const { rows } = await exportTerrainJournalLines('2024-01-01', '2024-01-31')

    expect(rows.map((row) => row.LineId)).toEqual(['split-1', 'split-2', 'txn-b-legacy'])
    expect(rows.map((row) => row.JournalId)).toEqual(['txn-a', 'txn-a', 'txn-b'])
  })
})
