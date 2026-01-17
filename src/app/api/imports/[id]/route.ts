import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  const { data, error } = await supabaseAdmin
    .from('imports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Import not found.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ ok: true, data: { import: data } })
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('imports')
    .update({
      status: 'canceled',
      canceled_at: now,
    })
    .eq('id', id)
    .in('status', ['queued', 'running'])
    .select('*')
    .single()

  if (error || !data) {
    const { data: existing } = await supabaseAdmin
      .from('imports')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Import not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, data: { import: existing } })
  }

  return NextResponse.json({ ok: true, data: { import: data } })
}
