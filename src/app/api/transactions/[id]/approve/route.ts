import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createRuleFromApproval } from '@/lib/categorization-engine';

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

    // Fetch the transaction to get payee/description for rule creation
    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('payee, description, reviewed')
      .eq('id', transactionId)
      .single();

    if (fetchError || !transaction) {
      console.error('[API] Transaction fetch error:', fetchError);
      return NextResponse.json(
        {
          ok: false,
          error: 'Transaction not found',
          details: fetchError?.message,
        },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      reviewed: true,
      updated_at: new Date().toISOString(),
    };

    // Only update category if provided
    if (category_id) {
      updateData.category_id = category_id;
      if (subcategory_id) {
        updateData.subcategory_id = subcategory_id;
      }
    }

    // Update the transaction
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single();

    if (updateError) {
      console.error('[API] Transaction update error:', updateError);
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to update transaction',
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    // Create a categorization rule for future transactions (async, non-blocking)
    if (category_id) {
      createRuleFromApproval(
        transaction.payee,
        transaction.description,
        category_id,
        subcategory_id
      ).catch((err) => {
        console.warn('[API] Rule creation failed (non-fatal):', err);
      });
    }

    return NextResponse.json({
      ok: true,
      data: updated,
    });
  } catch (error) {
    console.error('[API] Approve transaction error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
