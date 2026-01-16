import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createRuleFromApproval } from '@/lib/categorization-engine'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const transactionId = params.id || body?.transaction_id

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 })
    }

    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('id, payee, description, status')
      .eq('id', transactionId)
      .single()

    if (fetchError || !transaction) {
      console.error('Transaction fetch failed', fetchError)
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const hasCategoryId = Object.prototype.hasOwnProperty.call(body, 'category_id')
    const shouldReview = body?.mark_reviewed ?? true

    const updatePayload: Record<string, unknown> = {}
    if (hasCategoryId) {
      updatePayload.category_id = body.category_id
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
        { error: updateError.message ?? 'Failed to approve transaction' },
        { status: 500 }
      )
    }

    if (shouldReview && hasCategoryId && body.category_id && transaction) {
      await createRuleFromApproval(
        transaction.payee,
        transaction.description,
        body.category_id,
        null
      )
    }

    return NextResponse.json({ transaction: updated })
  } catch (error) {
    console.error('Transaction approval error', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      { status: 500 }
    )
  }
}
