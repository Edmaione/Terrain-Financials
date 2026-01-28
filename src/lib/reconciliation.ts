import { supabaseAdmin } from '@/lib/supabase/admin';
import { BankStatement, ReconciliationSummary, StatementGridCell } from '@/types';

// ─── Storage ─────────────────────────────────────────────────────────────────

const BUCKET = 'bank-statements';

export async function ensureStorageBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  await supabaseAdmin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
  });
}

export async function uploadStatementFile(
  file: File,
  accountId: string,
  periodLabel: string
): Promise<{ url: string; fileName: string; fileType: string; fileSize: number }> {
  await ensureStorageBucket();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${accountId}/${periodLabel}_${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`File upload failed: ${error.message}`);
  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return {
    url: urlData.publicUrl,
    fileName: file.name,
    fileType: ext,
    fileSize: file.size,
  };
}

export async function deleteStatementFile(fileUrl: string) {
  // Extract path after bucket name
  const idx = fileUrl.indexOf(`/${BUCKET}/`);
  if (idx === -1) return;
  const path = fileUrl.substring(idx + BUCKET.length + 2);
  await supabaseAdmin.storage.from(BUCKET).remove([path]);
}

// ─── Beginning Balance ───────────────────────────────────────────────────────

export async function getBeginningBalance(
  accountId: string,
  periodStart: string
): Promise<number> {
  // Try: latest reconciled statement ending before this period
  const { data: prev } = await supabaseAdmin
    .from('bank_statements')
    .select('ending_balance, period_end')
    .eq('account_id', accountId)
    .eq('status', 'reconciled')
    .lt('period_end', periodStart)
    .order('period_end', { ascending: false })
    .limit(1)
    .single();

  if (prev) return Number(prev.ending_balance);

  // Fallback: opening_balance + sum of txns from opening_balance_date to periodStart
  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('opening_balance, opening_balance_date')
    .eq('id', accountId)
    .single();

  const openingBalance = Number(account?.opening_balance) || 0;
  const openingDate = account?.opening_balance_date;

  if (!openingDate) {
    // No opening date — sum all txns before periodStart
    const { data: txns } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('account_id', accountId)
      .lt('date', periodStart)
      .is('deleted_at', null);
    const txnSum = (txns || []).reduce((s, t) => s + (t.amount || 0), 0);
    return openingBalance + txnSum;
  }

  // Sum txns from opening_balance_date to day before periodStart
  const { data: txns } = await supabaseAdmin
    .from('transactions')
    .select('amount')
    .eq('account_id', accountId)
    .gte('date', openingDate)
    .lt('date', periodStart)
    .is('deleted_at', null);

  const txnSum = (txns || []).reduce((s, t) => s + (t.amount || 0), 0);
  return openingBalance + txnSum;
}

// ─── Reconciliation Summary ─────────────────────────────────────────────────

export async function computeReconciliationSummary(
  statementId: string
): Promise<ReconciliationSummary | null> {
  // Fetch statement
  const { data: stmt } = await supabaseAdmin
    .from('bank_statements')
    .select('*, account:accounts(*)')
    .eq('id', statementId)
    .single();

  if (!stmt) return null;

  const isCreditCard = stmt.account?.type === 'credit_card';

  const rawBeginning = stmt.beginning_balance != null
    ? Number(stmt.beginning_balance)
    : await getBeginningBalance(stmt.account_id, stmt.period_start);

  // For credit cards, statement balances are positive (amount owed) but internal
  // transactions are negative (charges). Negate statement balances so math works
  // in internal convention, then we'll display back in statement convention in the UI.
  const signFlip = isCreditCard ? -1 : 1;
  const beginningBalance = rawBeginning * signFlip;
  const stmtEndingBalance = Number(stmt.ending_balance) * signFlip;

  // Fetch all txns in period for this account
  const allTxns: any[] = [];
  let from = 0;
  while (true) {
    const { data: page } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('account_id', stmt.account_id)
      .gte('date', stmt.period_start)
      .lte('date', stmt.period_end)
      .is('deleted_at', null)
      .order('date')
      .range(from, from + 999);
    if (!page || page.length === 0) break;
    allTxns.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }

  // Fetch cleared txn IDs for this statement
  const { data: clearedRows } = await supabaseAdmin
    .from('statement_transactions')
    .select('transaction_id')
    .eq('statement_id', statementId);

  const clearedSet = new Set((clearedRows || []).map((r) => r.transaction_id));

  const transactions = allTxns.map((t) => ({
    ...t,
    is_cleared: clearedSet.has(t.id),
  }));

  let clearedDeposits = 0;
  let clearedWithdrawals = 0;
  let clearedCount = 0;
  let unclearedCount = 0;

  for (const t of transactions) {
    if (t.is_cleared) {
      clearedCount++;
      if (t.amount >= 0) clearedDeposits += t.amount;
      else clearedWithdrawals += Math.abs(t.amount);
    } else {
      unclearedCount++;
    }
  }

  const computedEndingBalance = beginningBalance + clearedDeposits - clearedWithdrawals;
  const difference = stmtEndingBalance - computedEndingBalance;

  // Get unmatched statement transactions (from PDF extraction)
  const unmatchedStatementTransactions = Array.isArray(stmt.unmatched_transactions)
    ? stmt.unmatched_transactions
    : [];

  return {
    statement: stmt as BankStatement,
    beginning_balance: beginningBalance,
    cleared_deposits: clearedDeposits,
    cleared_withdrawals: clearedWithdrawals,
    computed_ending_balance: computedEndingBalance,
    difference: Math.round(difference * 100) / 100,
    cleared_count: clearedCount,
    uncleared_count: unclearedCount,
    is_credit_card: isCreditCard,
    transactions,
    unmatched_statement_transactions: unmatchedStatementTransactions,
  };
}

// ─── Auto-match ──────────────────────────────────────────────────────────────

export async function autoMatchTransactions(statementId: string): Promise<number> {
  const { data: stmt } = await supabaseAdmin
    .from('bank_statements')
    .select('account_id, period_start, period_end')
    .eq('id', statementId)
    .single();
  if (!stmt) return 0;

  // Get txns in period that have a source_hash
  const { data: txns } = await supabaseAdmin
    .from('transactions')
    .select('id, source_hash')
    .eq('account_id', stmt.account_id)
    .gte('date', stmt.period_start)
    .lte('date', stmt.period_end)
    .is('deleted_at', null)
    .not('source_hash', 'is', null);

  if (!txns || txns.length === 0) return 0;

  // Get already-cleared txn IDs
  const { data: existing } = await supabaseAdmin
    .from('statement_transactions')
    .select('transaction_id')
    .eq('statement_id', statementId);
  const existingSet = new Set((existing || []).map((r) => r.transaction_id));

  const toInsert = txns
    .filter((t) => !existingSet.has(t.id))
    .map((t) => ({
      statement_id: statementId,
      transaction_id: t.id,
      match_method: 'auto_hash',
    }));

  if (toInsert.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('statement_transactions')
    .insert(toInsert);

  if (error) {
    console.error('[reconciliation] auto-match insert error', error);
    return 0;
  }

  // Update statement status to in_progress if pending
  await supabaseAdmin
    .from('bank_statements')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', statementId)
    .eq('status', 'pending');

  return toInsert.length;
}

// ─── Statement Grid ──────────────────────────────────────────────────────────

export async function getStatementGrid(year: number): Promise<StatementGridCell[]> {
  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (!accounts || accounts.length === 0) return [];

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data: statements } = await supabaseAdmin
    .from('bank_statements')
    .select('id, account_id, period_start, period_end, status')
    .gte('period_end', yearStart)
    .lte('period_start', yearEnd);

  const stmtMap = new Map<string, { id: string; status: string }>();
  (statements || []).forEach((s) => {
    // Key by account + month of period_end
    const month = s.period_end.substring(0, 7);
    stmtMap.set(`${s.account_id}:${month}`, { id: s.id, status: s.status });
  });

  const cells: StatementGridCell[] = [];
  for (const acct of accounts) {
    for (let m = 1; m <= 12; m++) {
      const month = `${year}-${String(m).padStart(2, '0')}`;
      const key = `${acct.id}:${month}`;
      const stmt = stmtMap.get(key);
      cells.push({
        account_id: acct.id,
        account_name: acct.name,
        month,
        statement_id: stmt?.id ?? null,
        status: (stmt?.status as any) ?? null,
      });
    }
  }

  return cells;
}

// ─── String Similarity ───────────────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .trim();
}

function stringSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;

  // Check if one contains the other
  if (na.includes(nb) || nb.includes(na)) {
    return 0.8;
  }

  // Longest common substring ratio
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  let maxLen = 0;
  for (let i = 0; i < shorter.length; i++) {
    for (let j = i + 1; j <= shorter.length; j++) {
      const sub = shorter.substring(i, j);
      if (longer.includes(sub) && sub.length > maxLen) {
        maxLen = sub.length;
      }
    }
  }
  return maxLen / longer.length;
}

// ─── Extracted Transaction Matching ──────────────────────────────────────────

export interface MatchResult {
  matched: number;
  created: number;
  unmatched: Array<{ date: string; description: string; amount: number }>;
}

export async function matchExtractedTransactions(
  statementId: string,
  extractedTxns: Array<{ date: string; description: string; amount: number; type?: string; card?: string }>,
  options: { createMissing?: boolean } = {}
): Promise<MatchResult> {
  const { createMissing = true } = options; // Default to creating missing transactions

  const { data: stmt } = await supabaseAdmin
    .from('bank_statements')
    .select('account_id, period_start, period_end, account:accounts(type)')
    .eq('id', statementId)
    .single();
  if (!stmt) return { matched: 0, created: 0, unmatched: extractedTxns };

  const isCreditCard = (stmt.account as any)?.type === 'credit_card';
  const dateTolerance = isCreditCard ? 3 : 1; // ±3 days for CC, ±1 for others

  console.log(`[reconciliation] Matching ${extractedTxns.length} extracted transactions for statement ${statementId}`);

  // Fetch DB transactions with payee for description matching
  const { data: dbTxns } = await supabaseAdmin
    .from('transactions')
    .select('id, date, amount, payee, description')
    .eq('account_id', stmt.account_id)
    .gte('date', stmt.period_start)
    .lte('date', stmt.period_end)
    .is('deleted_at', null);

  console.log(`[reconciliation] Found ${dbTxns?.length || 0} existing DB transactions in period`);

  // Get already-cleared txn IDs
  const { data: existing } = await supabaseAdmin
    .from('statement_transactions')
    .select('transaction_id')
    .eq('statement_id', statementId);
  const existingSet = new Set((existing || []).map((r) => r.transaction_id));

  const matchedDbIds = new Set<string>();
  const toInsertCleared: Array<{ statement_id: string; transaction_id: string; match_method: string }> = [];
  const unmatchedTxns: Array<{ date: string; description: string; amount: number; type?: string; card?: string }> = [];

  for (const ext of extractedTxns) {
    const extDate = ext.date;
    const extAmt = Math.round(ext.amount * 100);
    const extDesc = ext.description || '';

    // Find all candidates that match on amount and are within date tolerance
    const candidates: Array<{
      id: string;
      dayDiff: number;
      descSimilarity: number;
      score: number;
    }> = [];

    for (const db of dbTxns || []) {
      if (matchedDbIds.has(db.id) || existingSet.has(db.id)) continue;

      const dbAmt = Math.round(db.amount * 100);
      if (dbAmt !== extAmt) continue;

      const extD = new Date(extDate).getTime();
      const dbD = new Date(db.date).getTime();
      const dayDiff = Math.abs(extD - dbD) / (1000 * 60 * 60 * 24);
      if (dayDiff > dateTolerance) continue;

      // Calculate description similarity
      const dbDesc = db.payee || db.description || '';
      const descSimilarity = stringSimilarity(extDesc, dbDesc);

      // Score: lower dayDiff is better, higher similarity is better
      // Normalize dayDiff to 0-1 scale (0 days = 1, max tolerance = 0)
      const dateScore = 1 - (dayDiff / (dateTolerance + 1));
      const score = dateScore * 0.6 + descSimilarity * 0.4;

      candidates.push({ id: db.id, dayDiff, descSimilarity, score });
    }

    if (candidates.length === 0) {
      unmatchedTxns.push(ext);
      continue;
    }

    // Pick best candidate by score
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    matchedDbIds.add(best.id);
    toInsertCleared.push({
      statement_id: statementId,
      transaction_id: best.id,
      match_method: 'pdf_extract',
    });
  }

  console.log(`[reconciliation] Matched: ${toInsertCleared.length}, Unmatched: ${unmatchedTxns.length}`);

  // Insert matched transactions as cleared
  if (toInsertCleared.length > 0) {
    const { error } = await supabaseAdmin
      .from('statement_transactions')
      .insert(toInsertCleared);

    if (error) {
      console.error('[reconciliation] pdf match insert error', error);
    }
  }

  // Create new transactions for unmatched items if enabled
  let createdCount = 0;
  if (createMissing && unmatchedTxns.length > 0) {
    console.log(`[reconciliation] Creating ${unmatchedTxns.length} new transactions from PDF`);

    const newTransactions = unmatchedTxns.map((ext) => ({
      account_id: stmt.account_id,
      date: ext.date,
      payee: ext.description,
      description: ext.card ? `Card: ${ext.card}` : null,
      amount: ext.amount,
      status: 'needs_review',
      source: 'pdf_statement',
      source_hash: `pdf_${statementId}_${ext.date}_${ext.description}_${ext.amount}`.substring(0, 64),
    }));

    const { data: createdTxns, error: createError } = await supabaseAdmin
      .from('transactions')
      .insert(newTransactions)
      .select('id');

    if (createError) {
      console.error('[reconciliation] Failed to create transactions:', createError);
      return {
        matched: toInsertCleared.length,
        created: 0,
        unmatched: unmatchedTxns
      };
    }

    createdCount = createdTxns?.length || 0;
    console.log(`[reconciliation] Created ${createdCount} new transactions`);

    // Mark newly created transactions as cleared for this statement
    if (createdTxns && createdTxns.length > 0) {
      const newCleared = createdTxns.map((t) => ({
        statement_id: statementId,
        transaction_id: t.id,
        match_method: 'pdf_created',
      }));

      const { error: clearError } = await supabaseAdmin
        .from('statement_transactions')
        .insert(newCleared);

      if (clearError) {
        console.error('[reconciliation] Failed to clear new transactions:', clearError);
      }
    }
  }

  // Only return truly unmatched if we didn't create them
  const finalUnmatched = createMissing ? [] : unmatchedTxns;

  return {
    matched: toInsertCleared.length,
    created: createdCount,
    unmatched: finalUnmatched
  };
}
