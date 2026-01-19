import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'json'
  const limitParam = searchParams.get('limit')
  const offsetParam = searchParams.get('offset')

  if (format === 'csv') {
    const { data, error } = await supabaseAdmin
      .from('import_row_issues')
      .select('row_number, severity, message')
      .eq('import_id', id)
      .order('row_number', { ascending: true })

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message ?? 'Failed to load import issues.' },
        { status: 500 }
      )
    }

    const header = ['row_number', 'severity', 'message']
    const rows = (data || []).map((issue) => [
      issue.row_number ?? '',
      issue.severity ?? '',
      issue.message ?? '',
    ])
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const stringValue = String(value ?? '')
            return `"${stringValue.replace(/"/g, '""')}"`
          })
          .join(',')
      )
      .join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="import-${id}-row-issues.csv"`,
      },
    })
  }

  const limit = limitParam ? Number.parseInt(limitParam, 10) : null
  const offset = offsetParam ? Number.parseInt(offsetParam, 10) : null

  let query = supabaseAdmin
    .from('import_row_issues')
    .select('id, row_number, severity, message, created_at', { count: 'exact' })
    .eq('import_id', id)
    .order('row_number', { ascending: true })

  if (Number.isFinite(offset)) {
    query = query.range(offset as number, (offset as number) + (limit ?? 49))
  } else if (Number.isFinite(limit)) {
    query = query.limit(limit as number)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message ?? 'Failed to load import issues.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    data: {
      issues: data ?? [],
      total: count ?? 0,
    },
  })
}
