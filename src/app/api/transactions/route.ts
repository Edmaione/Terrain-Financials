/**
 * @deprecated This route is deprecated. Use the following instead:
 * - POST /api/transactions/[id]/approve - To approve/review a transaction
 * - POST /api/transactions/[id]/categorize - To categorize without approving
 *
 * This route is kept for backward compatibility only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createRuleFromApproval } from '@/lib/categorization-engine';
import { recordReviewAction } from '@/lib/review-actions';
import { validateTransactionStatusPayload } from '@/lib/transaction-status';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const statusValidation = validateTransactionStatusPayload(body as Record<string, unknown>);
    if (!statusValidation.ok) {
      return NextResponse.json({ ok: false, error: statusValidation.error }, { status: 400 });
    }
    const { id, category_id, subcategory_id, reviewed } = body;
    const shouldReview = reviewed ?? true;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Transaction ID required' },
        { status: 400 }
      );
    }

    // Get the transaction to create a rule from it
    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('id, payee, description, category_id, primary_category_id, review_status')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('[API] Transaction fetch error:', fetchError);
      return NextResponse.json(
        { ok: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Update the transaction
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('transactions')
      .update({
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        primary_category_id: category_id || null,
        review_status: shouldReview ? 'approved' : 'needs_review',
        approved_at: shouldReview ? now : null,
        approved_by: shouldReview ? 'legacy' : null,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      console.error('[API] Transaction update error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    // If approved, create a rule for future transactions
    if (shouldReview && category_id && transaction) {
      await createRuleFromApproval(
        transaction.payee,
        transaction.description,
        category_id,
        subcategory_id
      ).catch((err) => {
        console.warn('[API] Rule creation failed (non-fatal):', err);
      });
    }

    if (shouldReview && transaction) {
      await recordReviewAction({
        transactionId: transaction.id,
        action:
          category_id && category_id !== transaction.primary_category_id ? 'reclass' : 'approve',
        actor: 'legacy',
        before: {
          review_status: transaction.review_status,
          category_id: transaction.primary_category_id ?? transaction.category_id,
        },
        after: {
          review_status: 'approved',
          category_id: category_id ?? transaction.primary_category_id,
        },
      });
    }

    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error) {
    console.error('[API] Transaction update error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}
