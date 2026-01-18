import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { accountId, changedBy } = body ?? {}

    if (!params.id) {
      return NextResponse.json({ ok: false, error: 'Transaction ID is required.' }, { status: 400 })
    }

    if (!accountId) {
      return NextResponse.json({ ok: false, error: 'Account ID is required.' }, { status: 400 })
    }

    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('id, account_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !transaction) {
      return NextResponse.json({ ok: false, error: 'Transaction not found.' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        account_id: accountId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
    }

    if (transaction.account_id !== accountId) {
      const { error: auditError } = await supabaseAdmin.from('transaction_audit').insert({
        transaction_id: transaction.id,
        field: 'account_id',
        old_value: transaction.account_id ?? null,
        new_value: accountId,
        changed_by: changedBy ?? 'manual',
      })

      if (auditError) {
        console.error('[API] Account audit error:', auditError)
      }
    }

    return NextResponse.json({ ok: true, data: { id: transaction.id } })
  } catch (error) {
    console.error('[API] Account update error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Account update failed' },
      { status: 500 }
    )
  }
}
