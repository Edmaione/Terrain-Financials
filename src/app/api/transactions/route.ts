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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, category_id, subcategory_id, reviewed } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Transaction ID required' },
        { status: 400 }
      );
    }

    // Get the transaction to create a rule from it
    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('payee, description')
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
    const { error } = await supabaseAdmin
      .from('transactions')
      .update({
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        reviewed: reviewed ?? true,
        updated_at: new Date().toISOString(),
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
    if (reviewed && category_id && transaction) {
      await createRuleFromApproval(
        transaction.payee,
        transaction.description,
        category_id,
        subcategory_id
      ).catch((err) => {
        console.warn('[API] Rule creation failed (non-fatal):', err);
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
