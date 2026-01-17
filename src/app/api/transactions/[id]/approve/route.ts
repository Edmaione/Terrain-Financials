import { NextRequest, NextResponse } from 'next/server'
import { normalizeExternalCategoryLabel } from '@/lib/category-mappings'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createRuleFromApproval } from '@/lib/categorization-engine'
import { recordReviewAction } from '@/lib/review-actions'

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

    const { categoryId = undefined, markReviewed = true, approvedBy } = body as {
      categoryId?: string | null
      markReviewed?: boolean
      approvedBy?: string | null
    }

    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select(
        'id, account_id, payee, description, status, review_status, category_id, primary_category_id, category_name'
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

    const updatePayload: Record<string, unknown> = {}
    if (hasCategoryId) {
      updatePayload.category_id = categoryId
      updatePayload.primary_category_id = categoryId
    }
    if (shouldReview) {
      updatePayload.reviewed = true
      updatePayload.reviewed_at = new Date().toISOString()
      updatePayload.review_status = 'approved'
      updatePayload.approved_at = new Date().toISOString()
      updatePayload.approved_by = approvedBy ?? 'manual'
    }
    if (transaction.status === 'PENDING') {
      updatePayload.status = 'APPROVED'
    }

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

    if (shouldReview && hasCategoryId && categoryId && transaction?.category_name) {
      const normalizedLabel = normalizeExternalCategoryLabel(transaction.category_name)
      if (normalizedLabel) {
        const { data: existingMapping } = await supabaseAdmin
          .from('category_mappings')
          .select('id, category_id')
          .eq('account_id', transaction.account_id)
          .eq('external_label_norm', normalizedLabel)
          .maybeSingle()

        if (!existingMapping) {
          const { error: mappingError } = await supabaseAdmin
            .from('category_mappings')
            .insert({
              account_id: transaction.account_id,
              external_label: transaction.category_name,
              external_label_norm: normalizedLabel,
              category_id: categoryId,
            })

          if (mappingError) {
            console.warn('[API] Category mapping creation failed (non-fatal):', mappingError)
          }
        }
      }
    }

    if (shouldReview) {
      const action =
        hasCategoryId && categoryId && categoryId !== transaction.primary_category_id
          ? 'reclass'
          : 'approve'
      await recordReviewAction({
        transactionId,
        action,
        actor: approvedBy ?? 'manual',
        before: {
          review_status: transaction.review_status,
          category_id: transaction.primary_category_id ?? transaction.category_id,
        },
        after: {
          review_status: 'approved',
          category_id: categoryId ?? transaction.primary_category_id ?? transaction.category_id,
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
