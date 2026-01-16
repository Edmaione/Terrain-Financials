import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { categorizeTransaction, detectTransactionType, createRuleFromApproval } from '@/lib/categorization-engine'
import { isDuplicateTransaction, isLikelyTransfer } from '@/lib/csv-parser'
import { ParsedTransaction } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const debugIngest = process.env.INGEST_DEBUG === 'true'
    const { transactions } = await request.json() as { transactions: ParsedTransaction[] }
    
    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions provided' },
        { status: 400 }
      )
    }
    
    if (debugIngest) {
      console.info('[ingest] Upload received', {
        parsedCount: transactions.length,
        sample: transactions.slice(0, 3),
      })
    }

    // Get default account (or we'll need to pass this from frontend)
    // For now, get first active account or create a default one
    let { data: accounts } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('is_active', true)
      .limit(1)
    
    let accountId: string
    
    if (!accounts || accounts.length === 0) {
      // Create default account
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
          { error: 'Failed to create default account' },
          { status: 500 }
        )
      }
      
      accountId = newAccount.id
    } else {
      accountId = accounts[0].id
    }

    if (debugIngest) {
      console.info('[ingest] Using account', { accountId })
    }
    
    // Get existing transactions for deduplication
    const dates = [...new Set(transactions.map(t => t.date))]
    const { data: existingTransactions } = await supabaseAdmin
      .from('transactions')
      .select('date, payee, amount')
      .in('date', dates)
    
    const existing = existingTransactions || []
    
    // Process transactions
    let importedCount = 0
    let duplicateCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    for (const transaction of transactions) {
      try {
        // Check for duplicates
        if (isDuplicateTransaction(transaction, existing)) {
          duplicateCount++
          continue
        }
        
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
        
        // Insert transaction
        if (debugIngest) {
          console.info('[ingest] Inserting transaction', {
            accountId,
            date: transaction.date,
            payee: transaction.payee,
            amount: transaction.amount,
            aiSuggestedCategory: categoryId,
            confidence,
          })
        }

        const { error: insertError } = await supabaseAdmin
          .from('transactions')
          .insert({
            account_id: accountId,
            date: transaction.date,
            payee: transaction.payee,
            description: transaction.description || null,
            amount: transaction.amount,
            reference: transaction.reference || null,
            status: transaction.status || 'SETTLED',
            is_transfer: isTransfer,
            ai_suggested_category: categoryId,
            ai_confidence: confidence,
            reviewed: false,
            raw_csv_data: transaction.raw_data,
          })
        
        if (insertError) {
          throw insertError
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
      success: true,
      parsed_count: transactions.length,
      imported_count: importedCount,
      duplicate_count: duplicateCount,
      error_count: errorCount,
      errors: errors.length > 0 ? errors : undefined,
    })
    
  } catch (error) {
    console.error('CSV upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
