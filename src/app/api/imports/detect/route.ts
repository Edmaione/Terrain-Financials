import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { detectAccountFromCsv } from '@/lib/account-detection'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fileText, headerFingerprint, headerSignature } = body ?? {}

    if (!fileText || typeof fileText !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'CSV file content is required.' },
        { status: 400 }
      )
    }

    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, institution, account_number, last4')
      .eq('is_active', true)
      .in('type', ['checking', 'savings', 'credit_card', 'loan'])
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (accountsError) {
      return NextResponse.json(
        { ok: false, error: accountsError.message },
        { status: 500 }
      )
    }

    const { data: mappings, error: mappingsError } = await supabaseAdmin
      .from('account_import_mappings')
      .select(
        'id, account_id, institution, statement_account_name, account_number, account_last4, header_signature, confidence'
      )

    if (mappingsError) {
      return NextResponse.json(
        { ok: false, error: mappingsError.message },
        { status: 500 }
      )
    }

    const detection = detectAccountFromCsv({
      csvText: fileText,
      accounts: accounts || [],
      mappings: mappings || [],
      headerSignature:
        typeof headerSignature === 'string' && headerSignature.length > 0
          ? headerSignature
          : typeof headerFingerprint === 'string' && headerFingerprint.length > 0
            ? headerFingerprint
          : null,
    })

    return NextResponse.json({ ok: true, data: { detection } })
  } catch (error) {
    console.error('Account detection error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Detection failed' },
      { status: 500 }
    )
  }
}
