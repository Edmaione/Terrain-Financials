import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { computeReconciliationSummary } from '@/lib/reconciliation';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const summary = await computeReconciliationSummary(params.id);
    if (!summary) {
      return NextResponse.json({ ok: false, error: 'Statement not found' }, { status: 404 });
    }

    // Check difference is zero
    if (Math.abs(summary.difference) > 0.005) {
      return NextResponse.json(
        { ok: false, error: `Cannot reconcile: difference is $${summary.difference.toFixed(2)}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Mark statement as reconciled
    const { error: stmtError } = await supabaseAdmin
      .from('bank_statements')
      .update({
        status: 'reconciled',
        reconciled_at: now,
        beginning_balance: summary.beginning_balance,
        updated_at: now,
      })
      .eq('id', params.id);

    if (stmtError) throw stmtError;

    // Mark all cleared transactions as reconciled
    const clearedIds = summary.transactions
      .filter((t) => t.is_cleared)
      .map((t) => t.id);

    if (clearedIds.length > 0) {
      const { error: txnError } = await supabaseAdmin
        .from('transactions')
        .update({
          reconciliation_status: 'reconciled',
          reconciled_at: now,
          updated_at: now,
        })
        .in('id', clearedIds);

      if (txnError) throw txnError;
    }

    return NextResponse.json({ ok: true, data: { reconciled_count: clearedIds.length } });
  } catch (error) {
    console.error('[API] statement reconcile error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
