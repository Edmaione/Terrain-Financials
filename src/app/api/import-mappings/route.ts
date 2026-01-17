import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { AmountStrategy, ImportFieldMapping } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')
    const headerFingerprint = searchParams.get('header_fingerprint')

    if (!accountId || !headerFingerprint) {
      return NextResponse.json(
        { ok: false, error: 'Account ID and header fingerprint are required.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('import_mappings')
      .select('id, mapping, amount_strategy, mapping_name')
      .eq('account_id', accountId)
      .eq('header_fingerprint', headerFingerprint)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch mapping.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        mapping: data ?? null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      account_id: accountId,
      mapping_name: mappingName,
      source,
      header_fingerprint: headerFingerprint,
      mapping,
      amount_strategy: amountStrategy,
    } = body ?? {}

    if (!accountId || !headerFingerprint || !mapping || !amountStrategy) {
      return NextResponse.json(
        { ok: false, error: 'Account ID, header fingerprint, mapping, and amount strategy are required.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('import_mappings')
      .upsert(
        {
          account_id: accountId,
          mapping_name: mappingName ?? null,
          source: source ?? null,
          header_fingerprint: headerFingerprint,
          mapping: mapping as ImportFieldMapping,
          amount_strategy: amountStrategy as AmountStrategy,
        },
        { onConflict: 'account_id,header_fingerprint' }
      )
      .select('id, mapping, amount_strategy, mapping_name')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? 'Failed to save mapping.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        mapping: data,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
