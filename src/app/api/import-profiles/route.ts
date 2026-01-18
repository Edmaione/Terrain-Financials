import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const institution = searchParams.get('institution')
    const headerSignature = searchParams.get('header_signature')

    if (!institution || !headerSignature) {
      return NextResponse.json(
        { ok: false, error: 'Institution and header signature are required.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('import_profiles')
      .select('*')
      .eq('institution', institution)
      .eq('header_signature', headerSignature)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        profile: data ?? null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
