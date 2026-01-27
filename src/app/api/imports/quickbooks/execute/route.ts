import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { classifyQBAccounts } from '@/lib/qb-import/classifier';
import { transformQBRows } from '@/lib/qb-import/transformer';
import { autoCreateEntities } from '@/lib/qb-import/setup';
import type { QBRow, QBAccountMap } from '@/lib/qb-import/types';
import type { Account, Category } from '@/types';
import Papa from 'papaparse';

export async function POST(req: NextRequest) {
  try {
    const { fileText, accountMap: userMap, options } = await req.json() as {
      fileText: string;
      accountMap: QBAccountMap;
      options?: { createMissing?: boolean };
    };

    if (!fileText || !userMap) {
      return NextResponse.json({ ok: false, error: 'fileText and accountMap are required' }, { status: 400 });
    }

    // Parse CSV (same logic as analyze)
    const parsed = Papa.parse<Record<string, string>>(fileText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    const rows: QBRow[] = parsed.data.map(raw => {
      const get = (keys: string[]) => {
        for (const k of keys) {
          const val = raw[k];
          if (val !== undefined && val !== '') return val;
        }
        return '';
      };
      return {
        Date: get(['Date', 'date', 'Trans Date']),
        Num: get(['Num', 'num', 'Number', 'Trans #']),
        Name: get(['Name', 'name', 'Payee']),
        Memo: get(['Memo', 'memo', 'Description']),
        PrimaryDebitAccount: get(['PrimaryDebitAccount', 'Primary Debit Account', 'Debit Account', 'Debit']),
        PrimaryDebitAmount: get(['PrimaryDebitAmount', 'Primary Debit Amount', 'Debit Amount']),
        PrimaryCreditAccount: get(['PrimaryCreditAccount', 'Primary Credit Account', 'Credit Account', 'Credit']),
        PrimaryCreditAmount: get(['PrimaryCreditAmount', 'Primary Credit Amount', 'Credit Amount']),
        Ed_Notes: get(['Ed_Notes', 'Ed Notes', 'Notes']),
      };
    });

    const validRows = rows.filter(r => r.Date && /\d/.test(r.Date));

    // Create import record
    const { data: importRecord, error: importError } = await supabaseAdmin
      .from('imports')
      .insert({
        account_id: '00000000-0000-0000-0000-000000000000', // placeholder for multi-account import
        file_name: 'quickbooks-gl-export.csv',
        file_size: fileText.length,
        status: 'running',
        total_rows: validRows.length,
        processed_rows: 0,
        inserted_rows: 0,
        skipped_rows: 0,
        error_rows: 0,
        started_at: new Date().toISOString(),
        detected_institution: 'QuickBooks',
        detection_method: 'quickbooks-gl-import',
      })
      .select('id')
      .single();

    if (importError || !importRecord) {
      return NextResponse.json({ ok: false, error: 'Failed to create import record' }, { status: 500 });
    }

    const importId = importRecord.id;

    // Auto-create missing entities if requested
    let accountMap = { ...userMap };
    let createdAccounts = 0;
    let createdCategories = 0;

    if (options?.createMissing !== false) {
      // Get classifications for metadata
      const [accountsRes, categoriesRes] = await Promise.all([
        supabaseAdmin.from('accounts').select('*'),
        supabaseAdmin.from('categories').select('*'),
      ]);
      const classifications = classifyQBAccounts(
        validRows,
        (accountsRes.data || []) as Account[],
        (categoriesRes.data || []) as Category[]
      );

      const result = await autoCreateEntities(accountMap, classifications);
      accountMap = result.accountMap;
      createdAccounts = result.createdAccounts;
      createdCategories = result.createdCategories;
    }

    // Transform rows
    const { transactions, stats } = transformQBRows(validRows, accountMap);

    // Insert transactions in batches
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const rows = batch.map(txn => ({
        account_id: txn.accountId,
        date: txn.date,
        payee: txn.payee,
        memo: txn.memo || null,
        amount: txn.amount,
        category_id: txn.categoryId || null,
        reference: txn.reference || null,
        is_transfer: txn.isTransfer,
        transfer_group_id: txn.transferGroupId || null,
        source: 'quickbooks' as const,
        source_id: txn.sourceId,
        source_hash: txn.sourceId, // use sourceId as hash for dedup
        notes: txn.notes || null,
        raw_csv_data: txn.rawCsvData,
        reviewed: true,
        review_status: 'approved' as const,
        import_id: importId,
        txn_status: 'posted' as const,
      }));

      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('transactions')
        .upsert(rows, {
          onConflict: 'account_id,source,source_hash',
          ignoreDuplicates: true,
        })
        .select('id');

      if (insertError) {
        console.error('[qb-execute] batch insert error:', insertError);
        errors += batch.length;
      } else {
        const count = insertedData?.length || 0;
        inserted += count;
        skipped += batch.length - count;
      }

      // Update progress
      await supabaseAdmin
        .from('imports')
        .update({
          processed_rows: Math.min(i + BATCH_SIZE, transactions.length),
          inserted_rows: inserted,
          skipped_rows: skipped,
          error_rows: errors,
        })
        .eq('id', importId);
    }

    // Finalize import
    await supabaseAdmin
      .from('imports')
      .update({
        status: errors > 0 && inserted === 0 ? 'failed' : 'succeeded',
        finished_at: new Date().toISOString(),
        processed_rows: transactions.length,
        inserted_rows: inserted,
        skipped_rows: skipped + stats.journalEntries,
        error_rows: errors,
      })
      .eq('id', importId);

    return NextResponse.json({
      ok: true,
      data: {
        importId,
        created: { accounts: createdAccounts, categories: createdCategories },
        transactions: {
          total: validRows.length,
          inserted,
          transfers: stats.transfers,
          skipped: skipped + stats.journalEntries,
          errors: errors + stats.errors.length,
        },
        warnings: stats.errors.length > 0 ? stats.errors.slice(0, 20) : undefined,
      },
    });
  } catch (err) {
    console.error('[qb-execute]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
