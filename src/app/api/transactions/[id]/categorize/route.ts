import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { recordReviewAction } from '@/lib/review-actions';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { category_id, subcategory_id } = body;
    const transactionId = params.id;

    if (!transactionId) {
      return NextResponse.json(
        { ok: false, error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    if (!category_id) {
      return NextResponse.json(
        { ok: false, error: 'Category ID is required' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id, category_id, primary_category_id, review_status')
      .eq('id', transactionId)
      .single();

    // Update the transaction with category (but don't mark as reviewed)
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        category_id,
        subcategory_id: subcategory_id || null,
        primary_category_id: category_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (updateError) {
      console.error('[API] Categorize error:', updateError);
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to categorize transaction',
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    if (updated && existing) {
      await recordReviewAction({
        transactionId,
        action: 'reclass',
        actor: 'manual',
        before: {
          review_status: existing.review_status,
          category_id: existing.primary_category_id ?? existing.category_id,
        },
        after: {
          review_status: existing.review_status ?? 'needs_review',
          category_id,
        },
      });
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error('[API] Categorize transaction error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
