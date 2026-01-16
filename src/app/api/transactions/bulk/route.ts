import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const ACTIONS = ['mark_reviewed', 'set_category', 'approve'] as const;

type BulkAction = (typeof ACTIONS)[number];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids, action, categoryId } = body ?? {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'Transaction IDs are required.' }, { status: 400 });
    }

    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ ok: false, error: 'Invalid bulk action.' }, { status: 400 });
    }

    if (action === 'set_category' && !categoryId) {
      return NextResponse.json(
        { ok: false, error: 'Category is required for bulk categorization.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      updated_at: now,
    };

    if (action === 'mark_reviewed') {
      updatePayload.reviewed = true;
      updatePayload.reviewed_at = now;
    }

    if (action === 'set_category') {
      updatePayload.category_id = categoryId;
    }

    if (action === 'approve') {
      updatePayload.status = 'APPROVED';
      updatePayload.reviewed = true;
      updatePayload.reviewed_at = now;
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .update(updatePayload)
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('[API] Bulk transaction update error:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to update transactions.', details: error.message },
        { status: 500 }
      );
    }

    console.info('[API] Bulk transaction update', {
      action,
      count: data?.length || 0,
    });

    return NextResponse.json({ ok: true, data: { ids: data?.map((row) => row.id) || [] } });
  } catch (error) {
    console.error('[API] Bulk transaction update error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bulk update failed' },
      { status: 500 }
    );
  }
}
