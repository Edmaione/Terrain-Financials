import { NextResponse } from 'next/server'
import { createRuleFromApproval, incrementRuleWrong } from '@/lib/categorization-engine'

export interface LearnCategorizationRequest {
  payee: string
  description?: string | null
  categoryId: string
  previousSuggestion?: {
    categoryId?: string | null
    ruleId?: string | null
  }
}

export interface LearnCategorizationResponse {
  ok: boolean
  ruleCreated: boolean
  error?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LearnCategorizationRequest

    if (!body.payee) {
      return NextResponse.json<LearnCategorizationResponse>(
        { ok: false, ruleCreated: false, error: 'payee is required' },
        { status: 400 }
      )
    }

    if (!body.categoryId) {
      return NextResponse.json<LearnCategorizationResponse>(
        { ok: false, ruleCreated: false, error: 'categoryId is required' },
        { status: 400 }
      )
    }

    // If user overrode a suggestion that came from a rule, penalize that rule
    if (
      body.previousSuggestion?.ruleId &&
      body.previousSuggestion.categoryId &&
      body.previousSuggestion.categoryId !== body.categoryId
    ) {
      try {
        await incrementRuleWrong(body.previousSuggestion.ruleId)
      } catch (err) {
        console.warn('[learn] Failed to penalize previous rule:', err)
      }
    }

    // Create or reinforce a rule for this payee -> category mapping
    try {
      await createRuleFromApproval(
        body.payee,
        body.description || undefined,
        body.categoryId
      )
    } catch (err) {
      console.error('[learn] Failed to create rule:', err)
      return NextResponse.json<LearnCategorizationResponse>(
        {
          ok: false,
          ruleCreated: false,
          error: err instanceof Error ? err.message : 'Failed to create rule',
        },
        { status: 500 }
      )
    }

    return NextResponse.json<LearnCategorizationResponse>({
      ok: true,
      ruleCreated: true,
    })
  } catch (error) {
    console.error('[API] Learn categorization error:', error)
    return NextResponse.json<LearnCategorizationResponse>(
      {
        ok: false,
        ruleCreated: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
