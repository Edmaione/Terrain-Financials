import { categorizeTransaction, detectTransactionType } from '@/lib/categorization-engine'
import { normalizeExternalCategoryLabel } from '@/lib/category-mappings'
import { isLikelyTransfer } from '@/lib/csv-parser'
import { assertBalancedSplits, computeSourceHash, normalizePayeeName } from '@/lib/ledger'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ParsedTransaction } from '@/types'

export type AccountLookup = {
  id: string
  name: string
  type: string
}

export type SplitCandidate = {
  account_id: string | null
  category_id: string | null
  amount: number
  memo?: string | null
}

export type PreparedTransaction = {
  transaction: {
    account_id: string
    date: string
    payee: string
    payee_id: string | null
    payee_original: string
    payee_display: string
    description: string | null
    memo: string | null
    amount: number
    category_id?: string | null
    primary_category_id?: string | null
    reference: string | null
    bank_status?: string | null
    reconciliation_status?: string | null
    cleared_at?: string | null
    reconciled_at?: string | null
    txn_status: 'posted' | 'void'
    is_transfer: boolean
    ai_suggested_category: string | null
    ai_confidence: number
    review_status: 'needs_review'
    reviewed: boolean
    source: string
    source_id: string | null
    source_hash: string
    raw_csv_data: Record<string, string>
    import_id: string
    import_row_number: number
    import_row_hash: string
    is_split: boolean
  }
  splits: SplitCandidate[]
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,()\s]/g, '')
    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeOptionalText(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function resolveTransactionFields(transaction: ParsedTransaction) {
  const memo = normalizeOptionalText(transaction.memo)
  const reference = normalizeOptionalText(transaction.reference)
  const description =
    normalizeOptionalText(transaction.description) ??
    memo ??
    reference ??
    normalizeOptionalText(transaction.payee)

  return {
    description,
    memo,
    reference,
  }
}

function extractRawAmount(raw: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (raw[key] !== undefined) {
      return parseOptionalNumber(raw[key])
    }
  }
  return null
}

function findAccountMatch(
  accounts: AccountLookup[],
  payee: string,
  types: string[]
) {
  const needle = payee.toLowerCase()
  return accounts.find(
    (account) => types.includes(account.type) && needle.includes(account.name.toLowerCase())
  )
}

function buildSplitCandidates({
  transactionAmount,
  accountId,
  payee,
  description,
  transferToAccountId,
  rawData,
  accounts,
}: {
  transactionAmount: number
  accountId: string
  payee: string
  description?: string | null
  transferToAccountId?: string | null
  rawData: Record<string, string>
  accounts: AccountLookup[]
}) {
  const splitCandidates: SplitCandidate[] = []

  if (transferToAccountId) {
    splitCandidates.push(
      {
        account_id: accountId,
        category_id: null,
        amount: transactionAmount,
        memo: 'Transfer out',
      },
      {
        account_id: transferToAccountId,
        category_id: null,
        amount: -transactionAmount,
        memo: 'Transfer in',
      }
    )
  } else {
    const matchedCredit = findAccountMatch(accounts, payee, ['credit_card'])
    const matchedLoan = findAccountMatch(accounts, payee, ['loan'])

    if (matchedCredit) {
      splitCandidates.push(
        {
          account_id: accountId,
          category_id: null,
          amount: transactionAmount,
          memo: 'Credit card payment',
        },
        {
          account_id: matchedCredit.id,
          category_id: null,
          amount: -transactionAmount,
          memo: 'Credit card liability',
        }
      )
    } else if (matchedLoan) {
      const principal = extractRawAmount(rawData, ['Principal', 'principal'])
      const interest = extractRawAmount(rawData, ['Interest', 'interest'])
      const total = Math.abs(transactionAmount)
      const hasBreakdown =
        principal !== null &&
        interest !== null &&
        Math.abs(principal + interest - total) < 0.01

      if (hasBreakdown) {
        splitCandidates.push(
          {
            account_id: accountId,
            category_id: null,
            amount: transactionAmount,
            memo: 'Loan payment',
          },
          {
            account_id: matchedLoan.id,
            category_id: null,
            amount: principal ?? 0,
            memo: 'Principal',
          },
          {
            account_id: null,
            category_id: null,
            amount: interest ?? 0,
            memo: 'Interest',
          }
        )
      } else {
        splitCandidates.push(
          {
            account_id: accountId,
            category_id: null,
            amount: transactionAmount,
            memo: 'Loan payment',
          },
          {
            account_id: matchedLoan.id,
            category_id: null,
            amount: -transactionAmount,
            memo: 'Principal',
          }
        )
      }
    }
  }

  if (splitCandidates.length === 0) {
    return []
  }

  assertBalancedSplits(splitCandidates)

  return splitCandidates
}

export async function prepareCsvTransactions({
  transactions,
  accountId,
  accounts,
  importId,
  rowOffset,
  rowHashForTransaction,
  debug,
}: {
  transactions: Array<ParsedTransaction & { rowNumber?: number; import_row_hash?: string | null }>
  accountId: string
  accounts: AccountLookup[]
  importId: string
  rowOffset: number
  rowHashForTransaction?: (transaction: ParsedTransaction, rowNumber: number) => string
  debug?: boolean
}) {
  const preparedTransactions: PreparedTransaction[] = []
  const errors: Array<{ rowNumber: number; message: string; rawRow?: Record<string, string> }> = []
  const normalizedCategoryLabels = Array.from(
    new Set(
      transactions
        .map((transaction) => normalizeExternalCategoryLabel(transaction.category))
        .filter((value): value is string => Boolean(value))
    )
  )
  const categoryMappingByLabel = new Map<string, string>()
  const categoryNameByLabel = new Map<string, string>()

  if (normalizedCategoryLabels.length > 0) {
    const { data: mappingRows, error: mappingError } = await supabaseAdmin
      .from('category_mappings')
      .select('external_label_norm, category_id')
      .eq('account_id', accountId)
      .in('external_label_norm', normalizedCategoryLabels)

    if (mappingError) {
      console.warn('[ingest] Category mapping lookup failed:', mappingError)
    } else {
      for (const mapping of mappingRows || []) {
        if (mapping.external_label_norm && mapping.category_id) {
          categoryMappingByLabel.set(mapping.external_label_norm, mapping.category_id)
        }
      }
    }

    const { data: categoryRows, error: categoryError } = await supabaseAdmin
      .from('categories')
      .select('id, name')

    if (categoryError) {
      console.warn('[ingest] Category lookup failed:', categoryError)
    } else {
      for (const category of categoryRows || []) {
        const normalized = normalizeExternalCategoryLabel(category.name)
        if (normalized && category.id && !categoryNameByLabel.has(normalized)) {
          categoryNameByLabel.set(normalized, category.id)
        }
      }
    }
  }

  for (const [index, transaction] of transactions.entries()) {
    const rowNumber = transaction.rowNumber ?? rowOffset + index + 1

    try {
      const { description, memo, reference } = resolveTransactionFields(transaction)
      const isTransfer = isLikelyTransfer(
        transaction.payee,
        description || '',
        transaction.account_number
      )

      const typeInfo = detectTransactionType(
        transaction.payee,
        description || '',
        reference || ''
      )

      const normalizedCategoryLabel = normalizeExternalCategoryLabel(transaction.category)
      const mappedCategoryId =
        (normalizedCategoryLabel &&
          (categoryMappingByLabel.get(normalizedCategoryLabel) ||
            categoryNameByLabel.get(normalizedCategoryLabel))) ||
        null
      let suggestedCategoryId: string | null = null
      let confidence = 0

      if (!mappedCategoryId && typeInfo.isPayroll && typeInfo.payrollType) {
        const categoryName =
          typeInfo.payrollType === 'wages'
            ? 'LS Technician Wages'
            : typeInfo.payrollType === 'taxes'
              ? 'LS Technician Payroll taxes'
              : 'Payroll Expenses & Fees'

        const { data: category } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('name', categoryName)
          .single()

        if (category) {
          suggestedCategoryId = category.id
          confidence = 0.98
        }
      } else if (!mappedCategoryId && typeInfo.isInsurance) {
        const { data: category } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('name', 'Insurance - Liability & Auto')
          .single()

        if (category) {
          suggestedCategoryId = category.id
          confidence = 0.95
        }
      } else if (!mappedCategoryId && typeInfo.isUtility) {
        const { data: category } = await supabaseAdmin
          .from('categories')
          .select('id')
          .eq('name', 'Utilities, Phone, Internet')
          .single()

        if (category) {
          suggestedCategoryId = category.id
          confidence = 0.95
        }
      }

      if (!mappedCategoryId && !suggestedCategoryId) {
        const suggestion = await categorizeTransaction({
          payee: transaction.payee,
          description,
          amount: transaction.amount,
        })

        suggestedCategoryId = suggestion.category_id
        confidence = suggestion.confidence
      }

      const normalizedPayee = normalizePayeeName(transaction.payee)
      const source = transaction.source_system || 'manual'
      const sourceId = reference || null
      const sourceHash = computeSourceHash({
        accountId,
        date: transaction.date,
        payee: normalizedPayee,
        description: description || '',
        amount: transaction.amount,
        reference: reference || '',
        source,
      })

      const splits = buildSplitCandidates({
        transactionAmount: transaction.amount,
        accountId,
        payee: normalizedPayee,
        description,
        transferToAccountId: null,
        rawData: transaction.raw_data,
        accounts,
      })

      const rowHash =
        transaction.import_row_hash ??
        rowHashForTransaction?.(transaction, rowNumber) ??
        computeSourceHash({
          accountId,
          date: transaction.date,
          payee: normalizedPayee,
          description: description || '',
          amount: transaction.amount,
          reference: reference || '',
          source,
        })

      const statusRaw = normalizeOptionalText(transaction.bank_status_raw ?? null)
      const normalizedStatusValue = normalizeOptionalText(transaction.bank_status ?? null)
      const allowedStatuses = new Set(['pending', 'posted'])
      const normalizedStatus =
        normalizedStatusValue && allowedStatuses.has(normalizedStatusValue)
          ? normalizedStatusValue
          : null
      const normalizedReconciliation =
        transaction.reconciliation_status === 'cleared' ||
        transaction.reconciliation_status === 'reconciled'
          ? transaction.reconciliation_status
          : 'unreconciled'
      const txnStatus =
        statusRaw && statusRaw.toLowerCase().includes('void') ? 'void' : 'posted'
      const reconciledAt =
        normalizedReconciliation === 'reconciled'
          ? new Date(`${transaction.date}T00:00:00Z`).toISOString()
          : null
      const clearedAt =
        normalizedReconciliation === 'cleared'
          ? new Date(`${transaction.date}T00:00:00Z`).toISOString()
          : null

      preparedTransactions.push({
        transaction: {
          account_id: accountId,
          date: transaction.date,
          payee: normalizedPayee,
          payee_id: null,
          payee_original: transaction.payee,
          payee_display: normalizedPayee,
          description: description || null,
          memo: memo || null,
          amount: transaction.amount,
          category_id: mappedCategoryId,
          primary_category_id: mappedCategoryId,
          reference: reference || null,
          bank_status: normalizedStatus,
          reconciliation_status: normalizedReconciliation,
          cleared_at: clearedAt,
          reconciled_at: reconciledAt,
          txn_status: txnStatus,
          is_transfer: isTransfer,
          ai_suggested_category: suggestedCategoryId,
          ai_confidence: confidence,
          review_status: 'needs_review',
          reviewed: false,
          source,
          source_id: sourceId,
          source_hash: sourceHash,
          raw_csv_data: transaction.raw_data,
          import_id: importId,
          import_row_number: rowNumber,
          import_row_hash: rowHash,
          is_split: splits.length > 0,
        },
        splits,
      })

      if (debug) {
        console.info('[ingest] Prepared transaction', {
          accountId,
          date: transaction.date,
          payee: transaction.payee,
          amount: transaction.amount,
          aiSuggestedCategory: mappedCategoryId ?? suggestedCategoryId,
          confidence,
        })
      }
    } catch (err) {
      errors.push({
        rowNumber,
        message: err instanceof Error ? err.message : 'Unknown error',
        rawRow: transaction.raw_data,
      })
    }
  }

  return { preparedTransactions, errors }
}
