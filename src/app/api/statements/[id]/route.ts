import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { computeReconciliationSummary, deleteStatementFile } from '@/lib/reconciliation';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const summary = await computeReconciliationSummary(params.id);
    if (!summary) {
      return NextResponse.json({ ok: false, error: 'Statement not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: summary });
  } catch (error) {
    console.error('[API] statement GET error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { ending_balance, beginning_balance, period_start, period_end, notes, status } = body;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (ending_balance !== undefined) update.ending_balance = parseFloat(ending_balance);
    if (beginning_balance !== undefined) update.beginning_balance = beginning_balance != null ? parseFloat(beginning_balance) : null;
    if (period_start) update.period_start = period_start;
    if (period_end) update.period_end = period_end;
    if (notes !== undefined) update.notes = notes || null;
    if (status) update.status = status;

    const { data, error } = await supabaseAdmin
      .from('bank_statements')
      .update(update)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[API] statement PATCH error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get file URL before delete
    const { data: stmt } = await supabaseAdmin
      .from('bank_statements')
      .select('file_url')
      .eq('id', params.id)
      .single();

    if (stmt?.file_url) {
      await deleteStatementFile(stmt.file_url);
    }

    // Delete linked statement_transactions first (foreign key)
    await supabaseAdmin
      .from('statement_transactions')
      .delete()
      .eq('statement_id', params.id);

    const { error } = await supabaseAdmin
      .from('bank_statements')
      .delete()
      .eq('id', params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API] statement DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
