import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { categorizeTransaction, detectTransactionType } from '@/lib/categorization-engine'
import { isLikelyTransfer } from '@/lib/csv-parser'
import { assertBalancedSplits, computeSourceHash, normalizePayeeName } from '@/lib/ledger'
import { planCsvImport } from '@/lib/import-idempotency'
import { ParsedTransaction } from '@/types'

type AccountLookup = {
  id: string
  name: string
  type: string
}

type SplitCandidate = {
  account_id: string | null
  category_id: string | null
  amount: number
  memo?: string | null
}

type PreparedTransaction = {
  transaction: {
    account_id: string
    date: string
    payee: string
    payee_id: string | null
    payee_original: string
    payee_display: string
    description: string | null
    amount: number
    reference: string | null
    status: string
    txn_status: 'posted'
    is_transfer: boolean
    ai_suggested_category: string | null
    ai_confidence: number
    review_status: 'needs_review'
    reviewed: boolean
    source: string
    source_id: string | null
    source_hash: string
    raw_csv_data: Record<string, string>
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

export async function POST(request: NextRequest) {
  try {
    const debugIngest = process.env.INGEST_DEBUG === 'true'
    const { transactions, accountId: requestedAccountId } = await request.json() as {
      transactions: ParsedTransaction[]
      accountId?: string
    }
    
    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No transactions provided' },
        { status: 400 }
      )
    }
    
    if (debugIngest) {
      console.info('[ingest] Upload received', {
        parsedCount: transactions.length,
        sample: transactions.slice(0, 3),
      })
    }

    let accountId = requestedAccountId

    if (!accountId) {
      const { data: accounts } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)

      if (!accounts || accounts.length === 0) {
        const { data: newAccount, error: accountError } = await supabaseAdmin
          .from('accounts')
          .insert({
            name: 'Default Account',
            type: 'checking',
            institution: 'Unknown',
            is_active: true,
          })
          .select('id')
          .single()

        if (accountError || !newAccount) {
          console.error('Failed to create account:', accountError)
          return NextResponse.json(
            { ok: false, error: 'Failed to create default account' },
            { status: 500 }
          )
        }

        accountId = newAccount.id
      } else {
        return NextResponse.json(
          { ok: false, error: 'Account selection is required before upload.' },
          { status: 400 }
        )
      }
    }

    if (!accountId) {
      return NextResponse.json(
        { ok: false, error: 'Account selection is required before upload.' },
        { status: 400 }
      )
    }

    const resolvedAccountId = accountId

    if (debugIngest) {
      console.info('[ingest] Using account', { accountId })
    }
    
    const { data: accountsLookup } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type')
      .eq('is_active', true)

    const activeAccounts = accountsLookup || []

    const inferredSource = transactions.find((item) => item.source_system)?.source_system ?? 'manual'

    const preparedTransactions: PreparedTransaction[] = []
    const errors: string[] = []

    for (const transaction of transactions) {
      try {
        // Detect transfer
        const isTransfer = isLikelyTransfer(
          transaction.payee,
          transaction.description || '',
          transaction.account_number
        )

        // Detect transaction type for smart categorization
        const typeInfo = detectTransactionType(
          transaction.payee,
          transaction.description,
          transaction.reference
        )

        // Get AI categorization suggestion
        let categoryId: string | null = null
        let confidence = 0

        // Special handling for known types
        if (typeInfo.isPayroll && typeInfo.payrollType) {
          // Get appropriate payroll category
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
            categoryId = category.id
            confidence = 0.98
          }
        } else if (typeInfo.isInsurance) {
          const { data: category } = await supabaseAdmin
            .from('categories')
            .select('id')
            .eq('name', 'Insurance - Liability & Auto')
            .single()

          if (category) {
            categoryId = category.id
            confidence = 0.95
          }
        } else if (typeInfo.isUtility) {
          const { data: category } = await supabaseAdmin
            .from('categories')
            .select('id')
            .eq('name', 'Utilities, Phone, Internet')
            .single()

          if (category) {
            categoryId = category.id
            confidence = 0.95
          }
        }

        // If no special type detected, use general categorization
        if (!categoryId) {
          const suggestion = await categorizeTransaction({
            payee: transaction.payee,
            description: transaction.description,
            amount: transaction.amount,
          })

          categoryId = suggestion.category_id
          confidence = suggestion.confidence
        }

        const normalizedPayee = normalizePayeeName(transaction.payee)
        const source = transaction.source_system || 'manual'
        const sourceId = transaction.reference?.trim() || null
        const sourceHash = computeSourceHash({
          accountId: resolvedAccountId,
          date: transaction.date,
          payee: normalizedPayee,
          description: transaction.description || '',
          amount: transaction.amount,
          reference: transaction.reference || '',
          source,
        })

        const splits = buildSplitCandidates({
          transactionAmount: transaction.amount,
          accountId: resolvedAccountId,
          payee: normalizedPayee,
          description: transaction.description,
          transferToAccountId: null,
          rawData: transaction.raw_data,
          accounts: activeAccounts,
        })

        const transactionPayload: PreparedTransaction = {
          transaction: {
            account_id: resolvedAccountId,
            date: transaction.date,
            payee: normalizedPayee,
            payee_id: null,
            payee_original: transaction.payee,
            payee_display: normalizedPayee,
            description: transaction.description || null,
            amount: transaction.amount,
            reference: transaction.reference || null,
            status: transaction.status || 'SETTLED',
            txn_status: 'posted',
            is_transfer: isTransfer,
            ai_suggested_category: categoryId,
            ai_confidence: confidence,
            review_status: 'needs_review',
            reviewed: false,
            source,
            source_id: sourceId,
            source_hash: sourceHash,
            raw_csv_data: transaction.raw_data,
          },
          splits,
        }

        preparedTransactions.push(transactionPayload)

        if (debugIngest) {
          console.info('[ingest] Prepared transaction', {
            accountId: resolvedAccountId,
            date: transaction.date,
            payee: transaction.payee,
            amount: transaction.amount,
            aiSuggestedCategory: categoryId,
            confidence,
          })
        }
      } catch (err) {
        errors.push(
          `Error processing transaction ${transaction.payee}: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        )
      }
    }

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
        .eq('account_id', resolvedAccountId)
        .in('source_id', sourceIds)
      existingRecords.push(...(existingBySourceId || []))
    }

    if (sourceHashes.length > 0) {
      const { data: existingByHash } = await supabaseAdmin
        .from('transactions')
        .select('id, source, source_id, source_hash')
        .eq('account_id', resolvedAccountId)
        .in('source_hash', sourceHashes)
      existingRecords.push(...(existingByHash || []))
    }

    const { inserts, updates } = planCsvImport(preparedTransactions, existingRecords)

    if (inserts.length === 0 && updates.length === 0) {
      return NextResponse.json({
        ok: true,
        data: {
          inserted: 0,
          updated: 0,
          skipped: errors.length,
          errors,
        },
      })
    }

    const { data: ingestSummary, error: ingestError } = await supabaseAdmin.rpc(
      'ingest_csv_transactions',
      {
        payload: {
          source: inferredSource,
          created_by: 'csv_upload',
          metadata: {
            parsed_count: transactions.length,
            account_id: resolvedAccountId,
          },
          insert_transactions: inserts,
          update_transactions: updates,
        },
      }
    )

    if (ingestError) {
      console.error('[ingest] Transaction ingest failed', ingestError)
      return NextResponse.json(
        { ok: false, error: ingestError.message ?? 'Failed to ingest transactions' },
        { status: 500 }
      )
    }

    const skippedCount = errors.length + (ingestSummary?.skipped ?? 0)

    if (debugIngest) {
      console.info('[ingest] Upload summary', {
        parsedCount: transactions.length,
        inserted: ingestSummary?.inserted ?? 0,
        updated: ingestSummary?.updated ?? 0,
        skipped: skippedCount,
      })
    }

    return NextResponse.json({
      ok: true,
      data: {
        inserted: ingestSummary?.inserted ?? 0,
        updated: ingestSummary?.updated ?? 0,
        skipped: skippedCount,
        errors,
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
