import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { classifyQBAccounts } from '@/lib/qb-import/classifier';
import type { QBRow } from '@/lib/qb-import/types';
import type { Account, Category } from '@/types';
import Papa from 'papaparse';

export async function POST(req: NextRequest) {
  try {
    const { fileText } = await req.json();
    if (!fileText || typeof fileText !== 'string') {
      return NextResponse.json({ ok: false, error: 'fileText is required' }, { status: 400 });
    }

    // Parse CSV
    const parsed = Papa.parse<Record<string, string>>(fileText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ ok: false, error: 'Failed to parse CSV', details: parsed.errors }, { status: 400 });
    }

    // Normalize column names - QB exports may have spaces or different naming
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

    // Filter out rows with no date (header rows, totals, etc.)
    const validRows = rows.filter(r => r.Date && /\d/.test(r.Date));

    // Fetch existing accounts and categories
    const [accountsRes, categoriesRes] = await Promise.all([
      supabaseAdmin.from('accounts').select('*'),
      supabaseAdmin.from('categories').select('*'),
    ]);

    const accounts = (accountsRes.data || []) as Account[];
    const categories = (categoriesRes.data || []) as Category[];

    // Classify
    const classifications = classifyQBAccounts(validRows, accounts, categories);

    // Compute stats
    const dates = validRows.map(r => r.Date).filter(Boolean).sort();
    const stats = {
      totalRows: validRows.length,
      dateRange: {
        start: dates[0] || '',
        end: dates[dates.length - 1] || '',
      },
      uniqueAccounts: classifications.length,
      transactionTypes: {
        expenses: 0,
        income: 0,
        transfers: 0,
        journalEntries: 0,
      },
    };

    // Quick type estimation
    for (const row of validRows) {
      const debitName = row.PrimaryDebitAccount?.trim();
      const creditName = row.PrimaryCreditAccount?.trim();
      const debitCls = classifications.find(c => c.qbName === debitName);
      const creditCls = classifications.find(c => c.qbName === creditName);

      const debitIsBank = debitCls?.type === 'bank_account';
      const creditIsBank = creditCls?.type === 'bank_account';

      if (debitIsBank && creditIsBank) stats.transactionTypes.transfers++;
      else if (debitIsBank) stats.transactionTypes.income++;
      else if (creditIsBank) stats.transactionTypes.expenses++;
      else stats.transactionTypes.journalEntries++;
    }

    return NextResponse.json({
      ok: true,
      data: { classifications, stats },
    });
  } catch (err) {
    console.error('[qb-analyze]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
