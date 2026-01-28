import { NextRequest, NextResponse } from 'next/server';
import { autoMatchTransactions } from '@/lib/reconciliation';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matched = await autoMatchTransactions(params.id);
    return NextResponse.json({ ok: true, data: { matched_count: matched } });
  } catch (error) {
    console.error('[API] auto-match error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
