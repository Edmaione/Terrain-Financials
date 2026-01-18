import { parseCSVText } from '@/lib/csv-parser'
import { prepareCsvTransactions, type PreparedTransaction } from '@/lib/csv-importer'
import { planCsvImport } from '@/lib/import-idempotency'
import { CanonicalImportRow, transformImportRows } from '@/lib/import/transform-to-canonical'
import { validateMapping } from '@/lib/import-mapping'
import { detectAndPairTransfers } from '@/lib/categorization-engine'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { AmountStrategy, ImportFieldMapping, ParsedTransaction } from '@/types'

const CHUNK_SIZE = 500

type ImportStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

type ImportRow = {
  id: string
  status: ImportStatus
  started_at: string | null
  canceled_at: string | null
}

type InsertedTransactionRow = {
  id: string
  import_row_hash: string | null
}

async function fetchImport(importId: string) {
  const { data, error } = await supabaseAdmin
    .from('imports')
    .select('id, status, started_at, canceled_at')
    .eq('id', importId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as ImportRow
}

async function markImportFailed(importId: string, message: string) {
  await supabaseAdmin
    .from('imports')
    .update({
      status: 'failed',
      last_error: message,
      finished_at: new Date().toISOString(),
    })
    .eq('id', importId)
}

async function insertTransactions(items: PreparedTransaction[]) {
  if (items.length === 0) {
    return { insertedRows: [] as InsertedTransactionRow[], skippedCount: 0 }
  }

  const insertPayload = items.map((item) => item.transaction)
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .upsert(insertPayload, {
      onConflict: 'import_id,import_row_hash',
      ignoreDuplicates: true,
    })
    .select('id, import_row_hash')

  if (error) {
    throw new Error(error.message)
  }

  const insertedRows = (data || []) as InsertedTransactionRow[]
  const skippedCount = insertPayload.length - insertedRows.length

  const splitsByHash = new Map(
    items.map((item) => [item.transaction.import_row_hash, item.splits])
  )

  const splitRows = insertedRows.flatMap((row) => {
    const splits = row.import_row_hash ? splitsByHash.get(row.import_row_hash) ?? [] : []
    return splits.map((split) => ({
      transaction_id: row.id,
      account_id: split.account_id,
      category_id: split.category_id,
      amount: split.amount,
      memo: split.memo ?? null,
    }))
  })

  if (splitRows.length > 0) {
    const { error: splitError } = await supabaseAdmin
      .from('transaction_splits')
      .insert(splitRows)

    if (splitError) {
      throw new Error(splitError.message)
    }
  }

  return { insertedRows, skippedCount }
}

async function updateTransactions(items: Array<PreparedTransaction & { id: string }>) {
  let updatedCount = 0

  for (const item of items) {
    const { error } = await supabaseAdmin
      .from('transactions')
      .update({
        ...item.transaction,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      throw new Error(error.message)
    }

    if (item.splits.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('transaction_splits')
        .delete()
        .eq('transaction_id', item.id)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      const splitRows = item.splits.map((split) => ({
        transaction_id: item.id,
        account_id: split.account_id,
        category_id: split.category_id,
        amount: split.amount,
        memo: split.memo ?? null,
      }))

      const { error: splitError } = await supabaseAdmin
        .from('transaction_splits')
        .insert(splitRows)

      if (splitError) {
        throw new Error(splitError.message)
      }
    }

    updatedCount += 1
  }

  return updatedCount
}

export async function runCsvImport({
  importId,
  accountId,
  fileText,
  mapping,
  amountStrategy,
  sourceSystem,
  canonicalRows,
  totalRows,
  errorRows: providedErrorRows,
}: {
  importId: string
  accountId: string
  fileText?: string
  mapping: ImportFieldMapping
  amountStrategy: AmountStrategy
  sourceSystem?: ParsedTransaction['source_system']
  canonicalRows?: CanonicalImportRow[]
  totalRows?: number
  errorRows?: number
}) {
  const debugIngest = process.env.INGEST_DEBUG === 'true'
  const shouldLogDescriptionStats = process.env.NODE_ENV !== 'production'

  try {
    const validation = validateMapping({ mapping, amountStrategy })
    if (!validation.isValid) {
      throw new Error(validation.errors.join(' '))
    }

    const importRecord = await fetchImport(importId)

    if (importRecord.status === 'canceled') {
      return
    }

    if (importRecord.status === 'queued') {
      const { data: started } = await supabaseAdmin
        .from('imports')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', importId)
        .eq('status', 'queued')
        .select('id')
        .single()

      if (!started) {
        return
      }
    } else if (importRecord.status === 'running' && importRecord.started_at) {
      return
    }

    let parsedTransactions: CanonicalImportRow[] = []
    let transformErrors: Array<{ rowNumber: number; field: string; message: string }> = []
    let totalRowCount = totalRows ?? 0

    if (canonicalRows && canonicalRows.length > 0) {
      parsedTransactions = canonicalRows
      transformErrors = []
      totalRowCount = totalRowCount || canonicalRows.length + (providedErrorRows ?? 0)
    } else if (fileText) {
      const parsedCsv = parseCSVText(fileText)
      totalRowCount = totalRowCount || parsedCsv.rows.length
      const transformResult = await transformImportRows({
        rows: parsedCsv.rows,
        mapping,
        amountStrategy,
        sourceSystem,
        accountId,
        importId,
      })
      parsedTransactions = transformResult.transactions
      transformErrors = transformResult.errors
    } else {
      throw new Error('Missing canonical rows or CSV file content for import.')
    }

    if (debugIngest) {
      console.info('[ingest] Parsed transactions', {
        importId,
        parsedCount: parsedTransactions.length,
        sample: parsedTransactions.slice(0, 3),
        transformErrors: transformErrors.slice(0, 3),
      })
    }

    await supabaseAdmin
      .from('imports')
      .update({ total_rows: totalRowCount })
      .eq('id', importId)

    const { data: accountsLookup } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type')
      .eq('is_active', true)

    const activeAccounts = accountsLookup || []

    let processedRows = 0
    let insertedRows = 0
    let skippedRows = 0
    let errorRows = providedErrorRows ?? transformErrors.length
    let descriptionPopulated = 0
    let descriptionMissing = 0

    for (let offset = 0; offset < parsedTransactions.length; offset += CHUNK_SIZE) {
      const currentImport = await fetchImport(importId)

      if (currentImport.status === 'canceled') {
        await supabaseAdmin
          .from('imports')
          .update({ finished_at: new Date().toISOString() })
          .eq('id', importId)
        return
      }

      const chunk = parsedTransactions.slice(offset, offset + CHUNK_SIZE)

      const { preparedTransactions, errors } = await prepareCsvTransactions({
        transactions: chunk,
        accountId,
        accounts: activeAccounts,
        importId,
        rowOffset: offset,
        rowHashForTransaction: undefined,
        debug: debugIngest,
      })

      errorRows += errors.length
      const chunkWithDescriptions = preparedTransactions.filter(
        (item) => Boolean(item.transaction.description)
      ).length
      descriptionPopulated += chunkWithDescriptions
      descriptionMissing += preparedTransactions.length - chunkWithDescriptions

      const sourceIds = preparedTransactions
        .map((item) => item.transaction.source_id)
        .filter((value): value is string => Boolean(value))
      const sourceHashes = preparedTransactions.map((item) => item.transaction.source_hash)

      const existingRecords: Array<{
        id: string
        source: string | null
        source_id: string | null
        source_hash: string | null
      }> = []

      if (sourceIds.length > 0) {
        const { data: existingBySourceId } = await supabaseAdmin
          .from('transactions')
          .select('id, source, source_id, source_hash')
          .eq('account_id', accountId)
          .in('source_id', sourceIds)
        existingRecords.push(...(existingBySourceId || []))
      }

      if (sourceHashes.length > 0) {
        const { data: existingByHash } = await supabaseAdmin
          .from('transactions')
          .select('id, source, source_id, source_hash')
          .eq('account_id', accountId)
          .in('source_hash', sourceHashes)
        existingRecords.push(...(existingByHash || []))
      }

      const { inserts, updates } = planCsvImport(preparedTransactions, existingRecords)

      const { insertedRows: inserted, skippedCount } = await insertTransactions(inserts)
      insertedRows += inserted.length
      skippedRows += skippedCount

      if (updates.length > 0) {
        const updatedCount = await updateTransactions(updates)
        skippedRows += updatedCount
      }

      processedRows += chunk.length

      await supabaseAdmin
        .from('imports')
        .update({
          processed_rows: processedRows + errorRows,
          inserted_rows: insertedRows,
          skipped_rows: skippedRows,
          error_rows: errorRows,
        })
        .eq('id', importId)
    }

    await supabaseAdmin
      .from('imports')
      .update({
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        processed_rows: processedRows + errorRows,
        inserted_rows: insertedRows,
        skipped_rows: skippedRows,
        error_rows: errorRows,
      })
      .eq('id', importId)

    const uniqueDates = Array.from(
      new Set(parsedTransactions.map((transaction) => transaction.date).filter(Boolean))
    )

    for (const date of uniqueDates) {
      try {
        await detectAndPairTransfers(accountId, date)
      } catch (transferError) {
        console.warn('[ingest] Transfer detection failed', transferError)
      }
    }

    if (shouldLogDescriptionStats) {
      console.info('[ingest] Description mapping summary', {
        importId,
        totalRows: parsedCsv.rows.length,
        descriptionPopulated,
        descriptionMissing,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed'
    await markImportFailed(importId, message)
  }
}
