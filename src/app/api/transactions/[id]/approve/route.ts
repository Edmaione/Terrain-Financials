import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createRuleFromApproval } from '@/lib/categorization-engine'

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

    const { categoryId = undefined, markReviewed = true } = body as {
      categoryId?: string | null
      markReviewed?: boolean
    }

    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('id, payee, description, status')
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
    }
    if (shouldReview) {
      updatePayload.reviewed = true
      updatePayload.reviewed_at = new Date().toISOString()
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
        await createRuleFromApproval(transaction.payee, transaction.description, categoryId, null)
      } catch (ruleError) {
        console.warn('[API] Rule creation failed (non-fatal):', ruleError)
      }
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
