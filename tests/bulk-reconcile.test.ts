import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/transactions/bulk/route'

const fromMock = vi.fn()
const selectMock = vi.fn()
const updateMock = vi.fn()
const insertMock = vi.fn()

vi.mock('@/lib/review-actions', () => ({
  recordReviewAction: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => fromMock(table),
  },
}))

describe('bulk reconciliation actions', () => {
  it('sets reconciliation fields when marking reconciled', async () => {
    const existingTransactions = [
      {
        id: 'txn-1',
        account_id: 'acc-1',
        category_id: null,
        primary_category_id: null,
        review_status: 'needs_review',
        reconciliation_status: 'unreconciled',
        deleted_at: null,
      },
    ]

    selectMock.mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: existingTransactions, error: null }),
    })

    const updatePayloads: Array<Record<string, unknown>> = []
    updateMock.mockImplementation((payload: Record<string, unknown>) => {
      updatePayloads.push(payload)
      return {
        in: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [{ id: 'txn-1' }], error: null }),
        }),
      }
    })

    insertMock.mockResolvedValue({ data: null, error: null })

    fromMock.mockImplementation((table: string) => {
      if (table === 'transactions') {
        return {
          select: selectMock,
          update: updateMock,
        }
      }
      if (table === 'transaction_audit') {
        return {
          insert: insertMock,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const request = new NextRequest('http://localhost/api/transactions/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: ['txn-1'], action: 'mark_reconciled' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(updatePayloads[0]).toMatchObject({
      reconciliation_status: 'reconciled',
    })
    expect(updatePayloads[0].reconciled_at).toBeTruthy()
    expect(updatePayloads[0].cleared_at).toBeTruthy()
  })
})
