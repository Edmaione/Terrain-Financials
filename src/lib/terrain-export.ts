import Papa from 'papaparse'
import { supabaseAdmin } from './supabase'
import { isReviewApproved } from './ledger'

export type TerrainJournalLine = {
  JournalDate: string
  JournalId: string
  LineId: string
  AccountCode: string
  AccountName: string
  Amount: number
  Description: string
  LineMemo: string
  PayeeName: string
  SourceSystem: string
  SourceId: string
  ApprovedBy: string
  ApprovedAt: string
}

export async function exportTerrainJournalLines(startDate: string, endDate: string) {
  const { data: transactions, error } = await supabaseAdmin
    .from('transactions')
    .select(
      `
        id,
        date,
        amount,
        description,
        payee,
        payee_original,
        payee_display,
        source,
        source_id,
        approved_by,
        approved_at,
        review_status,
        reviewed,
        is_split,
        primary_category_id,
        category_id,
        account_id
      `
    )
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error || !transactions) {
    throw new Error(error?.message ?? 'Failed to load transactions for Terrain export.')
  }

  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id, name, terrain_account_code')

  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('id, name, terrain_category_code')

  const accountMap = new Map((accounts || []).map((account) => [account.id, account]))
  const categoryMap = new Map((categories || []).map((category) => [category.id, category]))

  const splitTransactionIds = transactions
    .filter((transaction) => transaction.is_split)
    .map((transaction) => transaction.id)

  const splitMap = new Map<
    string,
    Array<{
      id: string
      amount: number
      memo?: string | null
      account_id?: string | null
      category_id?: string | null
    }>
  >()

  if (splitTransactionIds.length > 0) {
    const { data: splits } = await supabaseAdmin
      .from('transaction_splits')
      .select('id, transaction_id, amount, memo, account_id, category_id')
      .in('transaction_id', splitTransactionIds)

    ;(splits || []).forEach((split) => {
      const existing = splitMap.get(split.transaction_id) || []
      existing.push(split)
      splitMap.set(split.transaction_id, existing)
    })
  }

  const warnings: string[] = []
  const rows: TerrainJournalLine[] = []

  const approvedTransactions = transactions.filter((transaction) =>
    isReviewApproved(transaction.review_status, transaction.reviewed)
  )

  approvedTransactions.forEach((transaction) => {
    const payeeName = transaction.payee_display || transaction.payee_original || transaction.payee
    const sourceSystem = transaction.source || ''
    const sourceId = transaction.source_id || ''
    const approvedBy = transaction.approved_by || ''
    const approvedAt = transaction.approved_at || ''

    if (transaction.is_split && splitMap.has(transaction.id)) {
      splitMap.get(transaction.id)?.forEach((split) => {
        const account = split.account_id ? accountMap.get(split.account_id) : undefined
        const category = split.category_id ? categoryMap.get(split.category_id) : undefined
        const accountCode = account?.terrain_account_code || category?.terrain_category_code || ''
        const accountName = account?.name || category?.name || ''
        if (!accountCode) {
          warnings.push(`Missing account code for split ${split.id}`)
        }

        rows.push({
          JournalDate: transaction.date,
          JournalId: transaction.id,
          LineId: split.id,
          AccountCode: accountCode,
          AccountName: accountName,
          Amount: split.amount,
          Description: transaction.description || '',
          LineMemo: split.memo || '',
          PayeeName: payeeName || '',
          SourceSystem: sourceSystem,
          SourceId: sourceId,
          ApprovedBy: approvedBy,
          ApprovedAt: approvedAt,
        })
      })
      return
    }

    const category =
      transaction.primary_category_id
        ? categoryMap.get(transaction.primary_category_id)
        : transaction.category_id
          ? categoryMap.get(transaction.category_id)
          : undefined
    const accountCode = category?.terrain_category_code || ''
    if (!accountCode) {
      warnings.push(`Missing account code for transaction ${transaction.id}`)
    }

    rows.push({
      JournalDate: transaction.date,
      JournalId: transaction.id,
      LineId: `${transaction.id}-legacy`,
      AccountCode: accountCode,
      AccountName: category?.name || '',
      Amount: transaction.amount,
      Description: transaction.description || '',
      LineMemo: '',
      PayeeName: payeeName || '',
      SourceSystem: sourceSystem,
      SourceId: sourceId,
      ApprovedBy: approvedBy,
      ApprovedAt: approvedAt,
    })
  })

  const csv = Papa.unparse(rows, {
    columns: [
      'JournalDate',
      'JournalId',
      'LineId',
      'AccountCode',
      'AccountName',
      'Amount',
      'Description',
      'LineMemo',
      'PayeeName',
      'SourceSystem',
      'SourceId',
      'ApprovedBy',
      'ApprovedAt',
    ],
  })

  return { csv, rows, warnings }
}
