import { NextRequest, NextResponse } from 'next/server';
import { matchExtractedTransactions } from '@/lib/reconciliation';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { transactions, extractedData, createMissing = true } = await req.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ ok: true, matched_count: 0, created_count: 0, unmatched: [] });
    }

    console.log(`[match-extracted] Processing ${transactions.length} transactions for statement ${params.id}`);

    const result = await matchExtractedTransactions(params.id, transactions, { createMissing });

    console.log(`[match-extracted] Result: matched=${result.matched}, created=${result.created}, unmatched=${result.unmatched.length}`);

    // Save extracted data to the statement (unmatched list only if we didn't create them)
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      status: 'in_progress', // Auto-advance from pending
    };
    if (result.unmatched.length > 0) {
      update.unmatched_transactions = result.unmatched;
    }
    if (extractedData) {
      update.extracted_data = extractedData;
    }

    await supabaseAdmin
      .from('bank_statements')
      .update(update)
      .eq('id', params.id);

    return NextResponse.json({
      ok: true,
      matched_count: result.matched,
      created_count: result.created,
      unmatched: result.unmatched,
    });
  } catch (err) {
    console.error('[match-extracted] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
