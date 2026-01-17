import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runCsvImport } from '@/lib/import-runner'
import { CanonicalImportRow } from '@/lib/import/transform-to-canonical'
import { validateMapping } from '@/lib/import-mapping'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { AmountStrategy, ImportFieldMapping } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const accountId = formData.get('accountId')
    const mappingPayload = formData.get('mapping')
    const amountStrategy = formData.get('amountStrategy')
    const headerFingerprint = formData.get('headerFingerprint')
    const mappingId = formData.get('mappingId')
    const sourceSystem = formData.get('sourceSystem')
    const canonicalPayload = formData.get('canonicalRows')
    const totalRowsPayload = formData.get('totalRows')
    const errorRowsPayload = formData.get('errorRows')

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Account selection is required before upload.' },
        { status: 400 }
      )
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: 'CSV file is required.' },
        { status: 400 }
      )
    }

    if (!mappingPayload || typeof mappingPayload !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Field mapping configuration is required.' },
        { status: 400 }
      )
    }

    if (!amountStrategy || typeof amountStrategy !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Amount strategy is required.' },
        { status: 400 }
      )
    }

    if (!headerFingerprint || typeof headerFingerprint !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Header fingerprint is required.' },
        { status: 400 }
      )
    }

    let mapping: ImportFieldMapping
    try {
      mapping = JSON.parse(mappingPayload)
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: 'Invalid mapping payload.' },
        { status: 400 }
      )
    }

    const validation = validateMapping({
      mapping,
      amountStrategy: amountStrategy as AmountStrategy,
    })

    if (!validation.isValid) {
      return NextResponse.json(
        { ok: false, error: validation.errors.join(' ') },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileSha256 = createHash('sha256').update(buffer).digest('hex')
    let canonicalRows: CanonicalImportRow[] | undefined
    let totalRows: number | undefined
    let errorRows: number | undefined

    if (canonicalPayload && typeof canonicalPayload === 'string') {
      try {
        const parsed = JSON.parse(canonicalPayload)
        if (!Array.isArray(parsed)) {
          return NextResponse.json(
            { ok: false, error: 'Canonical rows payload must be an array.' },
            { status: 400 }
          )
        }
        canonicalRows = parsed as CanonicalImportRow[]
      } catch (error) {
        return NextResponse.json(
          { ok: false, error: 'Invalid canonical rows payload.' },
          { status: 400 }
        )
      }
    }

    if (totalRowsPayload && typeof totalRowsPayload === 'string') {
      const parsed = Number.parseInt(totalRowsPayload, 10)
      totalRows = Number.isFinite(parsed) ? parsed : undefined
    }

    if (errorRowsPayload && typeof errorRowsPayload === 'string') {
      const parsed = Number.parseInt(errorRowsPayload, 10)
      errorRows = Number.isFinite(parsed) ? parsed : undefined
    }

    const { data: existingImport } = await supabaseAdmin
      .from('imports')
      .select('*')
      .eq('account_id', accountId)
      .eq('file_sha256', fileSha256)
      .in('status', ['queued', 'running'])
      .maybeSingle()

    if (existingImport) {
      if (existingImport.status === 'queued') {
        void runCsvImport({
          importId: existingImport.id,
          accountId,
          fileText: buffer.toString('utf8'),
          mapping,
          amountStrategy: amountStrategy as AmountStrategy,
          sourceSystem:
            typeof sourceSystem === 'string' && sourceSystem.length > 0 ? sourceSystem : undefined,
          canonicalRows,
          totalRows,
          errorRows,
        })
      }

      return NextResponse.json({
        ok: true,
        data: {
          import: existingImport,
          existing: true,
        },
      })
    }

    const { data: createdImport, error } = await supabaseAdmin
      .from('imports')
      .insert({
        account_id: accountId,
        file_name: file.name,
        file_size: file.size,
        file_sha256: fileSha256,
        status: 'queued',
      })
      .select('*')
      .single()

    if (error || !createdImport) {
      const fallbackExisting = await supabaseAdmin
        .from('imports')
        .select('*')
        .eq('account_id', accountId)
        .eq('file_sha256', fileSha256)
        .in('status', ['queued', 'running'])
        .maybeSingle()

      if (fallbackExisting.data) {
        return NextResponse.json({
          ok: true,
          data: {
            import: fallbackExisting.data,
            existing: true,
          },
        })
      }

      return NextResponse.json(
        { ok: false, error: error?.message ?? 'Failed to create import.' },
        { status: 500 }
      )
    }

    const { error: attemptError } = await supabaseAdmin.from('import_attempts').insert({
      account_id: accountId,
      import_id: createdImport.id,
      filename: file.name,
      header_fingerprint: headerFingerprint,
      mapping_id: typeof mappingId === 'string' && mappingId.length > 0 ? mappingId : null,
      mapping,
    })

    if (attemptError) {
      return NextResponse.json(
        { ok: false, error: attemptError.message },
        { status: 500 }
      )
    }

    void runCsvImport({
      importId: createdImport.id,
      accountId,
      fileText: buffer.toString('utf8'),
      mapping,
      amountStrategy: amountStrategy as AmountStrategy,
      sourceSystem:
        typeof sourceSystem === 'string' && sourceSystem.length > 0 ? sourceSystem : undefined,
      canonicalRows,
      totalRows,
      errorRows,
    })

    return NextResponse.json({
      ok: true,
      data: {
        import: createdImport,
        existing: false,
      },
    })
  } catch (error) {
    console.error('CSV upload error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
