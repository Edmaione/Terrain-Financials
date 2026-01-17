import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { categorizeTransaction, detectTransactionType } from '@/lib/categorization-engine'
import { isLikelyTransfer } from '@/lib/csv-parser'
import { computeSourceHash, normalizePayeeName } from '@/lib/ledger'
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

async function ensurePayeeId(payeeName: string) {
  const normalized = normalizePayeeName(payeeName)
  const { data: existing } = await supabaseAdmin
    .from('payees')
    .select('id')
    .eq('name', normalized)
    .single()

  if (existing?.id) {
    return existing.id
  }

  const { data: created, error } = await supabaseAdmin
    .from('payees')
    .insert({
      name: normalized,
      display_name: payeeName,
    })
    .select('id')
    .single()

  if (error) {
    console.warn('[ingest] Failed to create payee', error)
    return null
  }

  return created?.id ?? null
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

async function createSplitsForTransaction({
  transactionId,
  transactionAmount,
  accountId,
  payee,
  description,
  transferToAccountId,
  rawData,
  accounts,
}: {
  transactionId: string
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
    return false
  }

  const total = splitCandidates.reduce((sum, split) => sum + split.amount, 0)
  if (Math.abs(total) > 0.01) {
    console.warn('[ingest] Split imbalance detected, skipping splits', {
      transactionId,
      total,
      payee,
      description,
    })
    return false
  }

  const { error } = await supabaseAdmin.from('transaction_splits').insert(
    splitCandidates.map((split) => ({
      transaction_id: transactionId,
      account_id: split.account_id,
      category_id: split.category_id,
      amount: split.amount,
      memo: split.memo ?? null,
    }))
  )

  if (error) {
    console.warn('[ingest] Failed to create splits', error)
    return false
  }

  await supabaseAdmin
    .from('transactions')
    .update({
      is_split: true,
    })
    .eq('id', transactionId)

  return true
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

    const { data: importBatch, error: importBatchError } = await supabaseAdmin
      .from('import_batches')
      .insert({
        source: inferredSource,
        metadata: {
          parsed_count: transactions.length,
          account_id: resolvedAccountId,
        },
        created_by: 'csv_upload',
      })
      .select('id')
      .single()

    if (importBatchError) {
      console.warn('[ingest] Failed to create import batch', importBatchError)
    }

    // Get existing transactions for deduplication
    const dates = [...new Set(transactions.map(t => t.date))]
    const { data: existingTransactions } = await supabaseAdmin
      .from('transactions')
      .select('id, date, payee, amount, source, source_id, source_hash')
      .in('date', dates)
      .eq('account_id', resolvedAccountId)
    
    const existing = existingTransactions || []
    
    // Process transactions
    let importedCount = 0
    let duplicateCount = 0
    let errorCount = 0
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
          const categoryName = typeInfo.payrollType === 'wages' 
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
        const payeeId = await ensurePayeeId(normalizedPayee)
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

        const existingBySourceId = sourceId
          ? existing.find((item) => item.source === source && item.source_id === sourceId)
          : null
        const existingByHash = existing.find((item) => item.source_hash === sourceHash)
        const existingMatch = existingBySourceId ?? existingByHash

        const transactionPayload = {
          account_id: resolvedAccountId,
          date: transaction.date,
          payee: normalizedPayee,
          payee_id: payeeId,
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
          import_batch_id: importBatch?.id ?? null,
          raw_csv_data: transaction.raw_data,
        }

        // Insert transaction
        if (debugIngest) {
          console.info('[ingest] Inserting transaction', {
            accountId: resolvedAccountId,
            date: transaction.date,
            payee: transaction.payee,
            amount: transaction.amount,
            aiSuggestedCategory: categoryId,
            confidence,
          })
        }

        if (existingMatch?.id) {
          const { error: updateError } = await supabaseAdmin
            .from('transactions')
            .update({
              ...transactionPayload,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingMatch.id)

          if (updateError) {
            throw updateError
          }

          duplicateCount++
          continue
        }

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('transactions')
          .insert(transactionPayload)
          .select('id')
          .single()

        if (insertError || !inserted) {
          throw insertError
        }

        if (inserted?.id) {
          await createSplitsForTransaction({
            transactionId: inserted.id,
            transactionAmount: transaction.amount,
            accountId: resolvedAccountId,
            payee: normalizedPayee,
            description: transaction.description,
            transferToAccountId: null,
            rawData: transaction.raw_data,
            accounts: activeAccounts,
          })
        }

        if (debugIngest) {
          console.info('[ingest] Inserted transaction', {
            payee: transaction.payee,
            date: transaction.date,
            amount: transaction.amount,
          })
        }
        
        importedCount++
        
      } catch (err) {
        errorCount++
        errors.push(`Error processing transaction ${transaction.payee}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    
    if (debugIngest) {
      console.info('[ingest] Upload summary', {
        parsedCount: transactions.length,
        importedCount,
        duplicateCount,
        errorCount,
      })
    }

    return NextResponse.json({
      ok: true,
      data: {
        parsed_count: transactions.length,
        imported_count: importedCount,
        duplicate_count: duplicateCount,
        error_count: errorCount,
        errors: errors.length > 0 ? errors : undefined,
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
