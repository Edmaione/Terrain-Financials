import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function fetchAccountBalance(accountId: string) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('amount')
    .eq('account_id', accountId)

  if (error) {
    console.error('[API] Account balance error:', error)
    throw new Error('Failed to calculate account balance')
  }

  return data?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, type, institution, account_number, notes, is_active } = body ?? {}

    if (!params.id) {
      return NextResponse.json({ ok: false, error: 'Account ID required.' }, { status: 400 })
    }

    if (!name || !type) {
      return NextResponse.json(
        { ok: false, error: 'Name and type are required.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('accounts')
      .update({
        name,
        type,
        institution: institution || null,
        account_number: account_number ? String(account_number).slice(-4) : null,
        notes: notes || null,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) {
      console.error('[API] Account update error:', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to update account', details: error.message },
        { status: 500 }
      )
    }

    const current_balance = await fetchAccountBalance(data.id)

    return NextResponse.json({ ok: true, data: { ...data, current_balance } })
  } catch (error) {
    console.error('[API] Account update error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!params.id) {
      return NextResponse.json({ ok: false, error: 'Account ID required.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('accounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) {
      console.error('[API] Account delete error:', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to deactivate account', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, data: { id: params.id } })
  } catch (error) {
    console.error('[API] Account delete error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
