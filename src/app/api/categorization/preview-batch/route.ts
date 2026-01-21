import { NextResponse } from 'next/server'
import { categorizeTransaction } from '@/lib/categorization-engine'

export interface PreviewCategorizationRequest {
  transactions: Array<{
    rowHash: string
    payee: string
    description?: string | null
    amount: number
  }>
}

export interface PreviewCategorizationSuggestion {
  rowHash: string
  categoryId: string | null
  categoryName: string | null
  confidence: number
  source: 'rule' | 'ai' | 'pattern'
  ruleId?: string
}

export interface PreviewCategorizationResponse {
  ok: boolean
  suggestions: PreviewCategorizationSuggestion[]
  error?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreviewCategorizationRequest


    if (!body.transactions || !Array.isArray(body.transactions)) {
      return NextResponse.json<PreviewCategorizationResponse>(
        { ok: false, suggestions: [], error: 'transactions array is required' },
        { status: 400 }
      )
    }

    if (body.transactions.length === 0) {
      return NextResponse.json<PreviewCategorizationResponse>({
        ok: true,
        suggestions: [],
      })
    }

    if (body.transactions.length > 50) {
      return NextResponse.json<PreviewCategorizationResponse>(
        { ok: false, suggestions: [], error: 'Maximum 50 transactions per batch' },
        { status: 400 }
      )
    }

    const suggestions: PreviewCategorizationSuggestion[] = []

    for (const txn of body.transactions) {
      if (!txn.rowHash || !txn.payee) {
        suggestions.push({
          rowHash: txn.rowHash || '',
          categoryId: null,
          categoryName: null,
          confidence: 0,
          source: 'ai',
        })
        continue
      }

      try {
        const result = await categorizeTransaction({
          payee: txn.payee,
          description: txn.description || undefined,
          amount: txn.amount,
        })

        // Determine source type based on whether a rule was used
        let source: 'rule' | 'ai' | 'pattern' = 'ai'
        if (result.rule_id) {
          source = 'rule'
        }

        suggestions.push({
          rowHash: txn.rowHash,
          categoryId: result.category_id,
          categoryName: null, // Will be looked up in batch below
          confidence: result.confidence,
          source,
          ruleId: result.rule_id,
        })
      } catch (err) {
        console.error(`[categorization] Error categorizing transaction ${txn.rowHash}:`, err)
        suggestions.push({
          rowHash: txn.rowHash,
          categoryId: null,
          categoryName: null,
          confidence: 0,
          source: 'ai',
        })
      }
    }

    // Batch lookup category names for all suggestions
    const categoryIds = suggestions
      .map((s) => s.categoryId)
      .filter((id): id is string => id !== null)

    if (categoryIds.length > 0) {
      const { supabaseAdmin } = await import('@/lib/supabase/admin')
      const uniqueCategoryIds = [...new Set(categoryIds)]

      const { data: categories } = await supabaseAdmin
        .from('categories')
        .select('id, name')
        .in('id', uniqueCategoryIds)

      if (categories) {
        const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
        for (const suggestion of suggestions) {
          if (suggestion.categoryId) {
            suggestion.categoryName = categoryMap.get(suggestion.categoryId) || null
          }
        }
      }
    }

    return NextResponse.json<PreviewCategorizationResponse>({
      ok: true,
      suggestions,
    })
  } catch (error) {
    console.error('[API] Preview categorization error:', error)
    return NextResponse.json<PreviewCategorizationResponse>(
      {
        ok: false,
        suggestions: [],
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
