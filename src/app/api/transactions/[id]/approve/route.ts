import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRuleFromApproval } from '@/lib/categorization-engine'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: 'Supabase environment variables are not configured.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
        },
      }
    )

    const body = await request.json().catch(() => ({}))
    const transactionId = params.id

    if (!transactionId) {
      return NextResponse.json({ ok: false, error: 'Transaction ID required' }, { status: 400 })
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
      return NextResponse.json({ ok: false, error: 'Transaction not found' }, { status: 404 })
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
        { ok: false, error: updateError.message ?? 'Failed to approve transaction', details: updateError },
        { status: 500 }
      )
    }

    if (shouldReview && hasCategoryId && categoryId && transaction) {
      await createRuleFromApproval(
        transaction.payee,
        transaction.description,
        categoryId,
        null
      )
    }

    return NextResponse.json({ ok: true, transaction: updated })
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
