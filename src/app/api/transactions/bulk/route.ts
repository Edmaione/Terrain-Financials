import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { recordReviewAction } from '@/lib/review-actions';
import { validateTransactionStatusPayload } from '@/lib/transaction-status';
import { createRuleFromApproval } from '@/lib/categorization-engine';

const ACTIONS = [
  'mark_reviewed',
  'set_category',
  'approve',
  'approve_with_ai', // New: approve using AI-suggested category
  'set_account',
  'mark_cleared',
  'mark_reconciled',
  'mark_unreconciled',
  'soft_delete',
  'restore',
] as const;

type BulkAction = (typeof ACTIONS)[number];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const statusValidation = validateTransactionStatusPayload(body ?? {});
    if (!statusValidation.ok) {
      return NextResponse.json({ ok: false, error: statusValidation.error }, { status: 400 });
    }
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
      updatePayload.reviewed = true;
      updatePayload.reviewed_at = now;
      updatePayload.review_status = 'approved';
      updatePayload.approved_at = now;
      updatePayload.approved_by = approvedBy ?? 'bulk';
    }

    // Atomic approve with AI-suggested categories
    if (action === 'approve_with_ai') {
      // Fetch transactions with their AI suggestions
      const { data: transactionsToApprove, error: fetchTxnError } = await supabaseAdmin
        .from('transactions')
        .select('id, payee, description, ai_suggested_category, primary_category_id, category_id, confidence, ai_confidence')
        .in('id', ids);

      if (fetchTxnError) {
        console.error('[API] Failed to fetch transactions for approve_with_ai', fetchTxnError);
        return NextResponse.json(
          { ok: false, error: 'Failed to fetch transactions.', details: fetchTxnError.message },
          { status: 500 }
        );
      }

      // Update each transaction with its AI-suggested category
      const updatePromises = (transactionsToApprove || []).map(async (txn) => {
        const suggestedCategoryId = txn.ai_suggested_category || txn.primary_category_id || txn.category_id;

        const txnUpdatePayload: Record<string, unknown> = {
          reviewed: true,
          reviewed_at: now,
          review_status: 'approved',
          approved_at: now,
          approved_by: approvedBy ?? 'bulk_ai',
          updated_at: now,
        };

        if (suggestedCategoryId) {
          txnUpdatePayload.category_id = suggestedCategoryId;
          txnUpdatePayload.primary_category_id = suggestedCategoryId;
        }

        const { error: updateTxnError } = await supabaseAdmin
          .from('transactions')
          .update(txnUpdatePayload)
          .eq('id', txn.id);

        if (updateTxnError) {
          console.warn('[API] Failed to update transaction', txn.id, updateTxnError);
          return { id: txn.id, success: false };
        }

        // Create rule from this approval if there's a category
        if (suggestedCategoryId && txn.payee) {
          try {
            await createRuleFromApproval(txn.payee, txn.description, suggestedCategoryId);
          } catch (ruleError) {
            console.warn('[API] Rule creation failed (non-fatal):', ruleError);
          }
        }

        return { id: txn.id, success: true };
      });

      const results = await Promise.all(updatePromises);
      const successIds = results.filter(r => r.success).map(r => r.id);

      console.info('[API] Bulk approve_with_ai complete', {
        requested: ids.length,
        succeeded: successIds.length,
      });

      // Record review actions
      await Promise.all(
        (transactionsToApprove || []).map((txn) => {
          const suggestedCategoryId = txn.ai_suggested_category || txn.primary_category_id || txn.category_id;
          return recordReviewAction({
            transactionId: txn.id,
            action: 'approve',
            actor: approvedBy ?? 'bulk_ai',
            before: {
              review_status: 'needs_review',
              category_id: txn.primary_category_id ?? txn.category_id,
            },
            after: {
              review_status: 'approved',
              category_id: suggestedCategoryId,
            },
          });
        })
      );

      return NextResponse.json({ ok: true, data: { ids: successIds } });
    }

    if (action === 'set_account') {
      updatePayload.account_id = accountId;
    }

    if (action === 'mark_cleared') {
      updatePayload.reconciliation_status = 'cleared';
      updatePayload.cleared_at = now;
      updatePayload.reconciled_at = null;
    }

    if (action === 'mark_reconciled') {
      updatePayload.reconciliation_status = 'reconciled';
      updatePayload.reconciled_at = now;
      updatePayload.cleared_at = now;
    }

    if (action === 'mark_unreconciled') {
      updatePayload.reconciliation_status = 'unreconciled';
      updatePayload.cleared_at = null;
      updatePayload.reconciled_at = null;
    }

    if (action === 'soft_delete') {
      updatePayload.deleted_at = now;
    }

    if (action === 'restore') {
      updatePayload.deleted_at = null;
    }

    const { data: existingTransactions } = await supabaseAdmin
      .from('transactions')
      .select(
        'id, account_id, category_id, primary_category_id, review_status, reconciliation_status, deleted_at'
      )
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

    if (
      action === 'mark_cleared' ||
      action === 'mark_reconciled' ||
      action === 'mark_unreconciled'
    ) {
      const reconciliationValue =
        action === 'mark_cleared'
          ? 'cleared'
          : action === 'mark_reconciled'
            ? 'reconciled'
            : 'unreconciled';
      const auditRows =
        existingTransactions?.map((row) => ({
          transaction_id: row.id,
          field: 'reconciliation_status',
          old_value: row.reconciliation_status ?? null,
          new_value: reconciliationValue,
          changed_by: approvedBy ?? 'bulk',
        })) ?? [];

      if (auditRows.length > 0) {
        const { error: auditError } = await supabaseAdmin
          .from('transaction_audit')
          .insert(auditRows);

        if (auditError) {
          console.error('[API] Bulk reconciliation audit error:', auditError);
        }
      }
    }

    if (action === 'soft_delete' || action === 'restore') {
      const auditRows =
        existingTransactions?.map((row) => ({
          transaction_id: row.id,
          field: 'deleted_at',
          old_value: row.deleted_at ?? null,
          new_value: action === 'soft_delete' ? now : null,
          changed_by: approvedBy ?? 'bulk',
        })) ?? [];

      if (auditRows.length > 0) {
        const { error: auditError } = await supabaseAdmin
          .from('transaction_audit')
          .insert(auditRows);

        if (auditError) {
          console.error('[API] Bulk delete audit error:', auditError);
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
