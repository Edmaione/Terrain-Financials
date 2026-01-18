import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { recordReviewAction } from '@/lib/review-actions';

const ACTIONS = ['mark_reviewed', 'set_category', 'approve', 'set_account'] as const;

type BulkAction = (typeof ACTIONS)[number];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids, action, categoryId, accountId, approvedBy } = body ?? {};

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

    if (action === 'set_account' && !accountId) {
      return NextResponse.json(
        { ok: false, error: 'Account is required for bulk account updates.' },
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
      updatePayload.review_status = 'approved';
      updatePayload.approved_at = now;
      updatePayload.approved_by = approvedBy ?? 'bulk';
    }

    if (action === 'set_category') {
      updatePayload.category_id = categoryId;
      updatePayload.primary_category_id = categoryId;
    }

    if (action === 'approve') {
      updatePayload.status = 'APPROVED';
      updatePayload.reviewed = true;
      updatePayload.reviewed_at = now;
      updatePayload.review_status = 'approved';
      updatePayload.approved_at = now;
      updatePayload.approved_by = approvedBy ?? 'bulk';
    }

    if (action === 'set_account') {
      updatePayload.account_id = accountId;
    }

    const { data: existingTransactions } = await supabaseAdmin
      .from('transactions')
      .select('id, account_id, category_id, primary_category_id, review_status')
      .in('id', ids);

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

    if (action === 'approve' || action === 'mark_reviewed' || action === 'set_category') {
      const existingMap = new Map(
        (existingTransactions || []).map((row) => [row.id, row])
      );
      await Promise.all(
        (data || []).map((row) => {
          const before = existingMap.get(row.id);
          if (!before) return Promise.resolve();
          return recordReviewAction({
            transactionId: row.id,
            action: action === 'set_category' ? 'reclass' : 'approve',
            actor: approvedBy ?? 'bulk',
            before: {
              review_status: before.review_status,
              category_id: before.primary_category_id ?? before.category_id,
            },
            after: {
              review_status:
                action === 'set_category'
                  ? before.review_status ?? 'needs_review'
                  : 'approved',
              category_id:
                action === 'set_category'
                  ? categoryId
                  : before.primary_category_id ?? before.category_id,
            },
          });
        })
      );
    }

    if (action === 'set_account') {
      const auditRows =
        existingTransactions
          ?.filter((row) => row.account_id !== accountId)
          .map((row) => ({
            transaction_id: row.id,
            field: 'account_id',
            old_value: row.account_id ?? null,
            new_value: accountId,
            changed_by: approvedBy ?? 'bulk',
          })) ?? [];

      if (auditRows.length > 0) {
        const { error: auditError } = await supabaseAdmin
          .from('transaction_audit')
          .insert(auditRows);

        if (auditError) {
          console.error('[API] Bulk account audit error:', auditError);
        }
      }
    }

    return NextResponse.json({ ok: true, data: { ids: data?.map((row) => row.id) || [] } });
  } catch (error) {
    console.error('[API] Bulk transaction update error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bulk update failed' },
      { status: 500 }
    );
  }
}
