import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createRuleFromApproval } from '@/lib/categorization-engine'
import { recordReviewAction } from '@/lib/review-actions'
import { validateTransactionStatusPayload } from '@/lib/transaction-status'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const transactionId = params.id

    if (!transactionId) {
      return NextResponse.json(
        { ok: false, error: 'Transaction ID required' },
        { status: 400 }
      )
    }

    const statusValidation = validateTransactionStatusPayload(body as Record<string, unknown>)
    if (!statusValidation.ok) {
      return NextResponse.json(
        { ok: false, error: statusValidation.error },
        { status: 400 }
      )
    }

    const { categoryId = undefined, markReviewed = true, approvedBy } = body as {
      categoryId?: string | null
      markReviewed?: boolean
      approvedBy?: string | null
    }

    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select(
        'id, account_id, payee, description, review_status, category_id, primary_category_id, bank_status'
      )
      .eq('id', transactionId)
      .single()

    if (fetchError || !transaction) {
      console.error('Transaction fetch failed', fetchError)
      return NextResponse.json(
        { ok: false, error: 'Transaction not found' },
        { status: 404 }
      )
    }

    const hasCategoryId = Object.prototype.hasOwnProperty.call(body, 'categoryId')
    const shouldReview = markReviewed ?? true
    const now = new Date().toISOString()

    const updatePayload: Record<string, unknown> = {}
    updatePayload.review_status = shouldReview ? 'approved' : 'needs_review'
    updatePayload.approved_at = shouldReview ? now : null
    updatePayload.approved_by = shouldReview ? approvedBy ?? 'manual' : null
    updatePayload.updated_at = now
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('transactions')
      .update(updatePayload)
      .eq('id', transactionId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Transaction approval update failed', updateError)
      return NextResponse.json(
        {
          ok: false,
          error: updateError.message ?? 'Failed to approve transaction',
          details: updateError,
        },
        { status: 500 }
      )
    }

    if (shouldReview && hasCategoryId && categoryId && transaction) {
      try {
        await createRuleFromApproval(transaction.payee, transaction.description, categoryId)
      } catch (ruleError) {
        console.warn('[API] Rule creation failed (non-fatal):', ruleError)
      }
    }

    if (shouldReview) {
      const beforeCategory = transaction.primary_category_id ?? transaction.category_id
      const afterCategory = categoryId ?? beforeCategory
      const action =
        categoryId && categoryId !== beforeCategory ? 'reclass' : 'approve'

      await recordReviewAction({
        transactionId,
        action,
        actor: approvedBy ?? 'manual',
        before: {
          review_status: transaction.review_status,
          category_id: beforeCategory,
        },
        after: {
          review_status: 'approved',
          category_id: afterCategory,
        },
      })
    }

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error('Transaction approval error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Approval failed',
        details: error,
      },
      { status: 500 }
    )
  }
}
