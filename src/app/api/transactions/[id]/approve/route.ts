import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createRuleFromApproval, normalizePayee } from '@/lib/categorization-engine'
import { recordReviewAction } from '@/lib/review-actions'
import { validateTransactionStatusPayload } from '@/lib/transaction-status'

export const runtime = 'nodejs'

/**
 * Track when user overrides an AI suggestion - used to improve rule accuracy
 */
async function trackCorrectionIfNeeded(
  transaction: { payee: string; ai_suggested_category?: string | null; applied_rule_id?: string | null },
  userSelectedCategoryId: string
): Promise<void> {
  const aiSuggested = transaction.ai_suggested_category;

  // If there was an AI suggestion and user chose something different, track it
  if (aiSuggested && aiSuggested !== userSelectedCategoryId) {
    console.info('[API] User corrected AI suggestion', {
      payee: transaction.payee,
      aiSuggested,
      userSelected: userSelectedCategoryId,
    });

    // If there was an applied rule, mark it as wrong
    if (transaction.applied_rule_id) {
      const { error } = await supabaseAdmin
        .from('categorization_rules')
        .update({
          times_wrong: supabaseAdmin.rpc('increment', { x: 1 }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.applied_rule_id);

      if (error) {
        // Fallback: fetch and update manually
        const { data: rule } = await supabaseAdmin
          .from('categorization_rules')
          .select('times_wrong, confidence')
          .eq('id', transaction.applied_rule_id)
          .single();

        if (rule) {
          const newTimesWrong = (rule.times_wrong ?? 0) + 1;
          const newConfidence = Math.max(0.1, (rule.confidence ?? 0.85) * 0.9);

          await supabaseAdmin
            .from('categorization_rules')
            .update({
              times_wrong: newTimesWrong,
              confidence: newConfidence,
              is_active: newConfidence >= 0.5,
              updated_at: new Date().toISOString(),
            })
            .eq('id', transaction.applied_rule_id);
        }
      }
    }

    // Try to find and penalize the rule that suggested wrong category via normalized payee
    const normalizedPayee = normalizePayee(transaction.payee);
    const { data: wrongRules } = await supabaseAdmin
      .from('categorization_rules')
      .select('id, times_wrong, confidence')
      .eq('payee_pattern_normalized', normalizedPayee)
      .eq('category_id', aiSuggested)
      .limit(1);

    if (wrongRules && wrongRules.length > 0) {
      const wrongRule = wrongRules[0];
      const newTimesWrong = (wrongRule.times_wrong ?? 0) + 1;
      const newConfidence = Math.max(0.1, (wrongRule.confidence ?? 0.85) * 0.9);

      await supabaseAdmin
        .from('categorization_rules')
        .update({
          times_wrong: newTimesWrong,
          confidence: newConfidence,
          is_active: newConfidence >= 0.5,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wrongRule.id);
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const transactionId = params.id

    if (!transactionId) {
      return NextResponse.json(
        { ok: false, error: 'Transaction ID required' },
        { status: 400 }
      )
    }

    const statusValidation = validateTransactionStatusPayload(body as Record<string, unknown>)
    if (!statusValidation.ok) {
      return NextResponse.json(
        { ok: false, error: statusValidation.error },
        { status: 400 }
      )
    }

    const { categoryId = undefined, markReviewed = true, approvedBy } = body as {
      categoryId?: string | null
      markReviewed?: boolean
      approvedBy?: string | null
    }

    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select(
        'id, account_id, payee, description, review_status, category_id, primary_category_id, bank_status, ai_suggested_category, applied_rule_id'
      )
      .eq('id', transactionId)
      .single()

    if (fetchError || !transaction) {
      console.error('Transaction fetch failed', fetchError)
      return NextResponse.json(
        { ok: false, error: 'Transaction not found' },
        { status: 404 }
      )
    }

    const hasCategoryId = Object.prototype.hasOwnProperty.call(body, 'categoryId')
    const shouldReview = markReviewed ?? true
    const now = new Date().toISOString()

    const updatePayload: Record<string, unknown> = {}
    updatePayload.review_status = shouldReview ? 'approved' : 'needs_review'
    updatePayload.approved_at = shouldReview ? now : null
    updatePayload.approved_by = shouldReview ? approvedBy ?? 'manual' : null
    updatePayload.updated_at = now
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('transactions')
      .update(updatePayload)
      .eq('id', transactionId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Transaction approval update failed', updateError)
      return NextResponse.json(
        {
          ok: false,
          error: updateError.message ?? 'Failed to approve transaction',
          details: updateError,
        },
        { status: 500 }
      )
    }

    if (shouldReview && hasCategoryId && categoryId && transaction) {
      // Track if this was a correction of AI suggestion
      try {
        await trackCorrectionIfNeeded(transaction, categoryId);
      } catch (correctionError) {
        console.warn('[API] Correction tracking failed (non-fatal):', correctionError);
      }

      // Create rule from this approval
      try {
        await createRuleFromApproval(transaction.payee, transaction.description, categoryId)
      } catch (ruleError) {
        console.warn('[API] Rule creation failed (non-fatal):', ruleError)
      }
    }

    if (shouldReview) {
      const beforeCategory = transaction.primary_category_id ?? transaction.category_id
      const afterCategory = categoryId ?? beforeCategory
      const action =
        categoryId && categoryId !== beforeCategory ? 'reclass' : 'approve'

      await recordReviewAction({
        transactionId,
        action,
        actor: approvedBy ?? 'manual',
        before: {
          review_status: transaction.review_status,
          category_id: beforeCategory,
        },
        after: {
          review_status: 'approved',
          category_id: afterCategory,
        },
      })
    }

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error('Transaction approval error', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Approval failed',
        details: error,
      },
      { status: 500 }
    )
  }
}
