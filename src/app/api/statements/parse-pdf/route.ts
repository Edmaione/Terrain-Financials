import { NextRequest, NextResponse } from 'next/server';
import { extractStatementData } from '@/lib/openai';
import { validateExtraction } from '@/lib/extraction/validator';
import { sanitizeExtractedTransactions } from '@/lib/extraction/sanitizer';
import { normalizeStatementAmount } from '@/lib/extraction/sign-normalizer';
import { AccountType } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const accountType = (formData.get('accountType') as AccountType) || undefined;
    const institution = (formData.get('institution') as string) || undefined;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ ok: false, error: 'Only PDF files are supported' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Pass account context for profile-based detection
    const accountContext = (accountType || institution)
      ? { accountType, institution }
      : undefined;

    const extracted = await extractStatementData(buffer, accountContext);

    if (!extracted) {
      return NextResponse.json(
        { ok: false, error: 'Failed to extract data from PDF. Ensure OPENAI_API_KEY is set.' },
        { status: 500 }
      );
    }

    const resolvedAccountType = accountType || extracted.account_type || 'checking';
    const isAmex = (institution || '').toLowerCase().includes('amex') ||
                   (institution || '').toLowerCase().includes('american express') ||
                   resolvedAccountType === 'credit_card';

    // Step 1: Sanitize extracted transactions (remove hallucinations, fix dates, dedup interest)
    let sanitization = null;
    if (extracted.transactions && Array.isArray(extracted.transactions)) {
      const result = sanitizeExtractedTransactions(extracted.transactions, {
        closingDate: extracted.period_end,
        isAmex,
      });
      extracted.transactions = result.transactions;
      sanitization = {
        removed_count: result.removed.length,
        fixed_count: result.fixed.length,
        removed: result.removed.map((r) => ({
          description: r.txn.description,
          amount: r.txn.amount,
          reason: r.reason,
        })),
        fixed: result.fixed.map((f) => ({
          description: f.txn.description,
          field: f.field,
          from: f.from,
          to: f.to,
        })),
      };

      if (result.removed.length > 0 || result.fixed.length > 0) {
        console.log(`[parse-pdf] Sanitization: removed ${result.removed.length}, fixed ${result.fixed.length}`);
        for (const r of result.removed) {
          console.log(`  Removed: "${r.txn.description}" — ${r.reason}`);
        }
      }
    }

    // Step 2: Normalize transaction amounts to DB convention
    if (extracted.transactions && Array.isArray(extracted.transactions)) {
      for (const txn of extracted.transactions) {
        txn.raw_amount = txn.amount;
        txn.amount = normalizeStatementAmount(txn.amount, resolvedAccountType as AccountType, txn.type);
      }
    }

    // Step 3: Validate (against raw/as-printed amounts for balance check)
    const validation = validateExtraction(
      {
        ...extracted,
        transactions: extracted.transactions?.map((t: { raw_amount?: number; amount: number; date: string; description: string; card?: string; type?: string }) => ({
          ...t,
          amount: t.raw_amount ?? t.amount,
        })),
      },
      resolvedAccountType as AccountType
    );

    return NextResponse.json({
      ok: true,
      data: extracted,
      validation,
      sanitization,
    });
  } catch (err) {
    console.error('[parse-pdf] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
