import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { transaction_ids, action } = await request.json();

    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'transaction_ids array is required' },
        { status: 400 }
      );
    }

    if (action === 'unclear') {
      const { error } = await supabaseAdmin
        .from('statement_transactions')
        .delete()
        .eq('statement_id', params.id)
        .in('transaction_id', transaction_ids);
      if (error) throw error;
    } else {
      // clear
      const rows = transaction_ids.map((tid: string) => ({
        statement_id: params.id,
        transaction_id: tid,
        match_method: 'manual',
      }));
      const { error } = await supabaseAdmin
        .from('statement_transactions')
        .upsert(rows, { onConflict: 'statement_id,transaction_id' });
      if (error) throw error;
    }

    // Update status to in_progress if pending
    await supabaseAdmin
      .from('bank_statements')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('status', 'pending');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API] statement clear error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
