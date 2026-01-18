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

export async function GET() {
  try {
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[API] Accounts fetch error:', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch accounts', details: error.message },
        { status: 500 }
      )
    }

    const enrichedAccounts = await Promise.all(
      (accounts || []).map(async (account) => ({
        ...account,
        current_balance: await fetchAccountBalance(account.id),
      }))
    )

    return NextResponse.json({ ok: true, data: enrichedAccounts })
  } catch (error) {
    console.error('[API] Accounts error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      type,
      institution,
      account_number,
      opening_balance,
      notes,
      is_active,
    } = body ?? {}

    if (!name || !type) {
      return NextResponse.json(
        { ok: false, error: 'Name and type are required.' },
        { status: 400 }
      )
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .ilike('name', name)
      .limit(1)

    if (existingError) {
      console.error('[API] Account uniqueness check error:', existingError)
      return NextResponse.json(
        { ok: false, error: 'Failed to validate account name', details: existingError.message },
        { status: 500 }
      )
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'An account with this name already exists.' },
        { status: 409 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('accounts')
      .insert({
        name,
        type,
        institution: institution || null,
        account_number: account_number ? String(account_number).slice(-4) : null,
        opening_balance: opening_balance ?? 0,
        notes: notes || null,
        is_active: is_active ?? true,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[API] Account create error:', error)
      return NextResponse.json(
        { ok: false, error: 'Failed to create account', details: error.message },
        { status: 500 }
      )
    }

    const current_balance = await fetchAccountBalance(data.id)

    return NextResponse.json({ ok: true, data: { ...data, current_balance } })
  } catch (error) {
    console.error('[API] Account create error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
