import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ImportFieldMapping } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      account_id: accountId,
      import_id: importId,
      filename,
      header_fingerprint: headerFingerprint,
      mapping_id: mappingId,
      mapping,
    } = body ?? {}

    if (!accountId || !importId || !headerFingerprint || !mapping) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Account ID, import ID, header fingerprint, and mapping are required.',
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('import_attempts')
      .insert({
        account_id: accountId,
        import_id: importId,
        filename: filename ?? null,
        header_fingerprint: headerFingerprint,
        mapping_id: mappingId ?? null,
        mapping: mapping as ImportFieldMapping,
      })
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? 'Failed to record import attempt.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        attempt: data,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
