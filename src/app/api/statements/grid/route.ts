import { NextRequest, NextResponse } from 'next/server';
import { getStatementGrid } from '@/lib/reconciliation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const grid = await getStatementGrid(year);
    return NextResponse.json({ ok: true, data: grid });
  } catch (error) {
    console.error('[API] statement grid error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
