import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runCsvImport } from '@/lib/import-runner'
import { CanonicalImportRow } from '@/lib/import/transform-to-canonical'
import { normalizeImportMapping, validateMapping } from '@/lib/import-mapping'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ALLOWED_POSTING_STATUSES, type StatusMappingValue } from '@/lib/import-status'
import { type DateFormatHint } from '@/lib/import-date-format'
import { AmountStrategy, ImportFieldMapping, SourceSystem } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const accountId = formData.get('accountId')
    const mappingPayload = formData.get('mapping')
    const amountStrategy = formData.get('amountStrategy')
    const headerFingerprint = formData.get('headerFingerprint')
    const headerSignature = formData.get('headerSignature')
    const mappingId = formData.get('mappingId')
    const sourceSystem = formData.get('sourceSystem')
    const statusMapPayload = formData.get('statusMap')
    const preflightPayload = formData.get('preflight')
    const dateFormatPayload = formData.get('dateFormat')
    const canonicalPayload = formData.get('canonicalRows')
    const totalRowsPayload = formData.get('totalRows')
    const errorRowsPayload = formData.get('errorRows')
    const detectionPayload = formData.get('detection')
    const detectionAcceptedPayload = formData.get('detectionAccepted')

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

    if (!headerSignature || typeof headerSignature !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Header signature is required.' },
        { status: 400 }
      )
    }

    let mapping: ImportFieldMapping
    try {
      mapping = normalizeImportMapping(JSON.parse(mappingPayload))
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
    let statusMap: Record<string, StatusMappingValue> | null = null
    let preflight: Record<string, unknown> | null = null
    let dateFormat: string | null = null
    let detection:
      | {
          suggestedAccountId: string | null
          confidence: number
          reason: string
          method?: string
          detected?: {
            institution?: string
            accountLast4?: string
            accountNumber?: string
            statementAccountName?: string
            headerSignature?: string | null
          }
        }
      | null = null
    let detectionAccepted = false

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

    if (statusMapPayload && typeof statusMapPayload === 'string') {
      try {
        statusMap = JSON.parse(statusMapPayload) as Record<string, StatusMappingValue>
        const allowed = new Set([...ALLOWED_POSTING_STATUSES, 'ignore'])
        for (const value of Object.values(statusMap ?? {})) {
          if (typeof value !== 'string' || !allowed.has(value)) {
            return NextResponse.json(
              { ok: false, error: 'Status mapping contains invalid values.' },
              { status: 400 }
            )
          }
        }
      } catch (error) {
        return NextResponse.json(
          { ok: false, error: 'Invalid status mapping payload.' },
          { status: 400 }
        )
      }
    }

    if (preflightPayload && typeof preflightPayload === 'string') {
      try {
        preflight = JSON.parse(preflightPayload)
      } catch (error) {
        return NextResponse.json(
          { ok: false, error: 'Invalid preflight payload.' },
          { status: 400 }
        )
      }
    }

    if (dateFormatPayload && typeof dateFormatPayload === 'string') {
      const allowedFormats = new Set(['ymd', 'mdy', 'dmy'])
      dateFormat = allowedFormats.has(dateFormatPayload) ? dateFormatPayload : null
    }

    if (detectionPayload && typeof detectionPayload === 'string') {
      try {
        detection = JSON.parse(detectionPayload)
        detectionAccepted = detectionAcceptedPayload === 'true'
      } catch (error) {
        return NextResponse.json(
          { ok: false, error: 'Invalid detection payload.' },
          { status: 400 }
        )
      }
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
          statusMap: statusMap ?? undefined,
          dateFormat: dateFormat as DateFormatHint | null,
          sourceSystem:
            typeof sourceSystem === 'string' && sourceSystem.length > 0 ? (sourceSystem as SourceSystem) : undefined,
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

    const detectionMethod =
      detection && detectionAccepted ? detection.method ?? 'header_match' : 'manual'

    const { data: createdImport, error } = await supabaseAdmin
      .from('imports')
      .insert({
        account_id: accountId,
        file_name: file.name,
        file_size: file.size,
        file_sha256: fileSha256,
        status: 'queued',
        preflight: preflight ?? {},
        detected_institution: detection?.detected?.institution ?? null,
        detected_account_last4: detection?.detected?.accountLast4 ?? null,
        detected_account_number: detection?.detected?.accountNumber ?? null,
        detected_statement_account_name: detection?.detected?.statementAccountName ?? null,
        detection_method: detectionMethod,
        detection_confidence: detection?.confidence ?? null,
        detection_reason: detection?.reason ?? null,
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

    const preflightIssues: Array<{
      rowNumber?: number
      severity?: string
      message?: string
      rawRow?: Record<string, string>
    }> = []

    if (preflight && Array.isArray(preflight.errors) && preflight.errors.length > 0) {
      preflightIssues.push(
        ...preflight.errors.map((issue: any) => ({
          rowNumber: issue.rowNumber ?? null,
          severity: 'error',
          message: issue.message ?? 'Preflight error',
          rawRow: issue.rawRow ?? null,
        }))
      )
    }

    if (preflight && Array.isArray(preflight.issues) && preflight.issues.length > 0) {
      preflightIssues.push(
        ...preflight.issues.map((issue: any) => ({
          rowNumber: issue.rowNumber ?? null,
          severity: issue.severity ?? 'warning',
          message: issue.message ?? 'Preflight warning',
          rawRow: issue.rawRow ?? null,
        }))
      )
    }

    if (preflightIssues.length > 0) {
      const issues = preflightIssues.map((issue) => ({
        import_id: createdImport.id,
        row_number: issue.rowNumber ?? null,
        severity: issue.severity ?? 'warning',
        message: issue.message ?? 'Preflight issue',
        raw_row: issue.rawRow ?? null,
      }))
      await supabaseAdmin.from('import_row_issues').insert(issues)
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

    if (detection?.detected) {
      const signature = {
        institution: detection.detected.institution ?? null,
        statement_account_name: detection.detected.statementAccountName ?? null,
        account_number: detection.detected.accountNumber ?? null,
        account_last4: detection.detected.accountLast4 ?? null,
        header_signature: detection.detected.headerSignature ?? headerFingerprint ?? null,
      }

      const mappingQuery = supabaseAdmin
        .from('account_import_mappings')
        .select('id')
        .limit(1)

      const eqOrNull = (query: any, column: string, value: string | null) => {
        if (value) {
          return query.eq(column, value)
        }
        return query.is(column, null)
      }

      let filteredQuery = mappingQuery
      filteredQuery = eqOrNull(filteredQuery, 'institution', signature.institution)
      filteredQuery = eqOrNull(
        filteredQuery,
        'statement_account_name',
        signature.statement_account_name
      )
      filteredQuery = eqOrNull(filteredQuery, 'account_number', signature.account_number)
      filteredQuery = eqOrNull(filteredQuery, 'account_last4', signature.account_last4)
      filteredQuery = eqOrNull(filteredQuery, 'header_signature', signature.header_signature)

      const { data: existingMapping } = await filteredQuery.maybeSingle()

      if (existingMapping?.id) {
        await supabaseAdmin
          .from('account_import_mappings')
          .update({
            account_id: accountId,
            confidence: detection.confidence ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingMapping.id)
      } else {
        await supabaseAdmin.from('account_import_mappings').insert({
          ...signature,
          account_id: accountId,
          confidence: detection.confidence ?? null,
        })
      }
    }

    let profileId: string | null = null
    if (sourceSystem === 'relay' && headerSignature) {
      const profilePayload = {
        institution: 'Relay',
        header_signature: headerSignature,
        column_map: mapping,
        transforms: {
          amountStrategy,
          dateFormat: dateFormat ?? preflight?.dateFormat ?? null,
        },
        status_map: statusMap ?? {},
        updated_at: new Date().toISOString(),
      }

      const { data: existingProfile } = await supabaseAdmin
        .from('import_profiles')
        .select('id')
        .eq('institution', profilePayload.institution)
        .eq('header_signature', profilePayload.header_signature)
        .maybeSingle()

      if (existingProfile?.id) {
        const { data: updatedProfile } = await supabaseAdmin
          .from('import_profiles')
          .update(profilePayload)
          .eq('id', existingProfile.id)
          .select('id')
          .single()
        profileId = updatedProfile?.id ?? existingProfile.id
      } else {
        const { data: createdProfile } = await supabaseAdmin
          .from('import_profiles')
          .insert(profilePayload)
          .select('id')
          .single()
        profileId = createdProfile?.id ?? null
      }

      if (profileId) {
        await supabaseAdmin
          .from('imports')
          .update({ profile_id: profileId })
          .eq('id', createdImport.id)
      }
    }

    void runCsvImport({
      importId: createdImport.id,
      accountId,
      fileText: buffer.toString('utf8'),
      mapping,
      amountStrategy: amountStrategy as AmountStrategy,
      statusMap: statusMap ?? undefined,
      dateFormat: dateFormat as DateFormatHint | null,
      sourceSystem:
        typeof sourceSystem === 'string' && sourceSystem.length > 0 ? (sourceSystem as SourceSystem) : undefined,
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
