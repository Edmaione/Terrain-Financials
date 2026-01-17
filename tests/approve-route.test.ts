import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/transactions/[id]/approve/route'

const selectMock = vi.fn()
const updateMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/review-actions', () => ({
  recordReviewAction: vi.fn(),
}))

vi.mock('@/lib/categorization-engine', () => ({
  createRuleFromApproval: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => fromMock(table),
  },
}))

describe('approve route', () => {
  it('records a review action when approving', async () => {
    const transaction = {
      id: 'txn-1',
      payee: 'Test Payee',
      description: 'Test',
      status: 'PENDING',
      review_status: 'needs_review',
      category_id: null,
      primary_category_id: null,
    }

    const updated = {
      ...transaction,
      review_status: 'approved',
      primary_category_id: 'cat-1',
    }

    const selectChain = {
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
      }),
    }

    const updateChain = {
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: updated, error: null }),
        }),
      }),
    }

    selectMock.mockReturnValue(selectChain)
    updateMock.mockReturnValue(updateChain)

    fromMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
    })

    const request = new NextRequest('http://localhost/api/transactions/txn-1/approve', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'cat-1', markReviewed: true, approvedBy: 'tester' }),
    })

    const response = await POST(request, { params: { id: 'txn-1' } })
    expect(response.status).toBe(200)
    const { recordReviewAction } = await import('@/lib/review-actions')
    expect(vi.mocked(recordReviewAction)).toHaveBeenCalledTimes(1)
  })
})
