import { supabaseAdmin } from './supabase';
import { isReviewApproved } from './ledger';
import { PLReport, PLReportLine, CashFlowData, WeeklySummary } from '@/types';

/**
 * Generate Profit & Loss report for a date range
 */
export async function generatePLReport(
  startDate: string,
  endDate: string,
  accountId?: string
): Promise<PLReport> {
  // Get all transactions in date range with categories
  let transactionsQuery = supabaseAdmin
    .from('transactions')
    .select(`
      *,
      primary_category:categories!primary_category_id(*),
      category:categories!category_id(*),
      subcategory:categories!subcategory_id(*)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('review_status', 'approved')
    .is('deleted_at', null);

  if (accountId) {
    transactionsQuery = transactionsQuery.eq('account_id', accountId);
  }

  const { data: transactions, error: transactionsError } = await transactionsQuery;

  if (transactionsError || !transactions) {
    console.error('[reports] Failed to fetch transactions', transactionsError);
    return {
      period_start: startDate,
      period_end: endDate,
      total_income: 0,
      total_cogs: 0,
      gross_profit: 0,
      total_expenses: 0,
      net_operating_income: 0,
      other_income: 0,
      other_expenses: 0,
      net_income: 0,
      lines: [],
    };
  }

  // Get all categories
  const { data: categories, error: categoriesError } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('sort_order');

  if (categoriesError || !categories) {
    console.error('[reports] Failed to fetch categories', categoriesError);
    return {
      period_start: startDate,
      period_end: endDate,
      total_income: 0,
      total_cogs: 0,
      gross_profit: 0,
      total_expenses: 0,
      net_operating_income: 0,
      other_income: 0,
      other_expenses: 0,
      net_income: 0,
      lines: [],
    };
  }

  const approvedTransactions = transactions.filter((transaction) =>
    isReviewApproved(transaction.review_status)
  );
  const splitTransactionIds = approvedTransactions
    .filter((transaction) => transaction.is_split)
    .map((transaction) => transaction.id);
  const splitMap = new Map<string, Array<{ amount: number; category_id?: string | null }>>();

  if (splitTransactionIds.length > 0) {
    const { data: splits } = await supabaseAdmin
      .from('transaction_splits')
      .select('transaction_id, amount, category_id')
      .in('transaction_id', splitTransactionIds);

    (splits || []).forEach((split) => {
      const existing = splitMap.get(split.transaction_id) || [];
      existing.push(split);
      splitMap.set(split.transaction_id, existing);
    });
  }

  // Calculate totals by category
  const categoryTotals = new Map<string, number>();

  approvedTransactions.forEach((transaction) => {
    if (transaction.is_split && splitMap.has(transaction.id)) {
      splitMap.get(transaction.id)?.forEach((split) => {
        if (!split.category_id) return;
        const current = categoryTotals.get(split.category_id) || 0;
        categoryTotals.set(split.category_id, current + Math.abs(split.amount));
      });
      return;
    }

    const categoryId =
      transaction.primary_category_id || transaction.subcategory_id || transaction.category_id;
    if (categoryId) {
      const current = categoryTotals.get(categoryId) || 0;
      categoryTotals.set(categoryId, current + Math.abs(transaction.amount));
    }
  });

  // Build report lines
  const lines: PLReportLine[] = [];
  let totalIncome = 0;
  let totalCOGS = 0;
  let totalExpenses = 0;
  let totalOtherIncome = 0;

  // Income section
  const incomeCategories = categories.filter(c => c.type === 'income');
  incomeCategories.forEach(cat => {
    const amount = categoryTotals.get(cat.id) || 0;
    totalIncome += amount;
    lines.push({
      category_id: cat.id,
      category_name: cat.name,
      section: 'Income',
      amount,
      is_parent: false,
      indent_level: 1,
    });
  });

  // COGS section
  const cogsParents = categories.filter(c => c.type === 'cogs' && !c.parent_id);
  cogsParents.forEach(parent => {
    const children = categories.filter(c => c.parent_id === parent.id);
    let parentTotal = 0;

    lines.push({
      category_id: parent.id,
      category_name: parent.name,
      section: 'Cost of Goods Sold',
      amount: 0,
      is_parent: true,
      indent_level: 1,
    });

    children.forEach(child => {
      const amount = categoryTotals.get(child.id) || 0;
      parentTotal += amount;
      lines.push({
        category_id: child.id,
        category_name: child.name,
        parent_category: parent.name,
        section: 'Cost of Goods Sold',
        amount,
        is_parent: false,
        indent_level: 2,
      });
    });

    // Update parent total
    const parentLine = lines.find(l => l.category_id === parent.id);
    if (parentLine) {
      parentLine.amount = parentTotal;
    }
    totalCOGS += parentTotal;
  });

  const grossProfit = totalIncome - totalCOGS;

  // Expenses section
  const expenseParents = categories.filter(c => c.type === 'expense' && !c.parent_id);
  expenseParents.forEach(parent => {
    const children = categories.filter(c => c.parent_id === parent.id);
    let parentTotal = 0;

    lines.push({
      category_id: parent.id,
      category_name: parent.name,
      section: 'Expenses',
      amount: 0,
      is_parent: true,
      indent_level: 1,
    });

    children.forEach(child => {
      const amount = categoryTotals.get(child.id) || 0;
      parentTotal += amount;
      lines.push({
        category_id: child.id,
        category_name: child.name,
        parent_category: parent.name,
        section: 'Expenses',
        amount,
        is_parent: false,
        indent_level: 2,
      });
    });

    const parentLine = lines.find(l => l.category_id === parent.id);
    if (parentLine) {
      parentLine.amount = parentTotal;
    }
    totalExpenses += parentTotal;
  });

  // Other Income
  const otherIncomeCategories = categories.filter(c => c.type === 'other_income');
  otherIncomeCategories.forEach(cat => {
    const amount = categoryTotals.get(cat.id) || 0;
    totalOtherIncome += amount;
    lines.push({
      category_id: cat.id,
      category_name: cat.name,
      section: 'Other Income',
      amount,
      is_parent: false,
      indent_level: 1,
    });
  });

  const netOperatingIncome = grossProfit - totalExpenses;
  const netIncome = netOperatingIncome + totalOtherIncome;

  return {
    period_start: startDate,
    period_end: endDate,
    total_income: totalIncome,
    total_cogs: totalCOGS,
    gross_profit: grossProfit,
    total_expenses: totalExpenses,
    net_operating_income: netOperatingIncome,
    other_income: totalOtherIncome,
    other_expenses: 0,
    net_income: netIncome,
    lines,
  };
}

/**
 * Generate cash flow data for visualization
 */
export async function generateCashFlowData(
  startDate: string,
  endDate: string,
  interval: 'day' | 'week' | 'month' = 'day',
  accountId?: string
): Promise<CashFlowData[]> {
  let transactionsQuery = supabaseAdmin
    .from('transactions')
    .select('date, amount')
    .gte('date', startDate)
    .lte('date', endDate)
    .is('deleted_at', null)
    .order('date');

  if (accountId) {
    transactionsQuery = transactionsQuery.eq('account_id', accountId);
  }

  const { data: transactions, error } = await transactionsQuery;

  if (error || !transactions) {
    console.error('[reports] Failed to fetch cash flow transactions', error);
    return [];
  }

  // Group by interval
  const grouped = new Map<string, { in: number; out: number }>();

  transactions.forEach(t => {
    const key = getIntervalKey(t.date, interval);
    const current = grouped.get(key) || { in: 0, out: 0 };
    
    if (t.amount > 0) {
      current.in += t.amount;
    } else {
      current.out += Math.abs(t.amount);
    }
    
    grouped.set(key, current);
  });

  // Convert to array with running balance
  const data: CashFlowData[] = [];
  let runningBalance = 0;

  Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, { in: cashIn, out: cashOut }]) => {
      const netChange = cashIn - cashOut;
      runningBalance += netChange;
      
      data.push({
        date,
        cash_in: cashIn,
        cash_out: cashOut,
        net_change: netChange,
        ending_balance: runningBalance,
      });
    });

  return data;
}

/**
 * Generate weekly summary
 */
export async function generateWeeklySummary(
  weekStart: string,
  weekEnd: string,
  accountId?: string
): Promise<WeeklySummary> {
  let transactionsQuery = supabaseAdmin
    .from('transactions')
    .select(`
      *,
      category:categories!category_id(*)
    `)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .is('deleted_at', null);

  if (accountId) {
    transactionsQuery = transactionsQuery.eq('account_id', accountId);
  }

  const { data: transactions, error } = await transactionsQuery;

 if (error || !transactions) {
    console.error('[reports] Failed to fetch weekly summary transactions', error);
    return {
      week_start: weekStart,
      week_end: weekEnd,
      total_income: 0,
      total_expenses: 0,
      net_change: 0,
      transaction_count: 0,
      unreviewed_count: 0,
      top_expenses: [],
    }
  }

  const splitIds = transactions.filter((t) => t.is_split).map((t) => t.id);
  const splitLookup = new Map<
    string,
    Array<{
      amount: number
      category?: { name?: string | null } | Array<{ name?: string | null }> | null
    }>
  >();

  if (splitIds.length > 0) {
    const { data: splits } = await supabaseAdmin
      .from('transaction_splits')
      .select('transaction_id, amount, category:categories!category_id(name)')
      .in('transaction_id', splitIds);

    (splits || []).forEach((split) => {
      const existing = splitLookup.get(split.transaction_id) || [];
      existing.push(split);
      splitLookup.set(split.transaction_id, existing);
    });
  }

  let totalIncome = 0;
  let totalExpenses = 0;
  const expensesByPayee = new Map<string, { amount: number; category: string }>();

  transactions.forEach((transaction) => {
    const splits = splitLookup.get(transaction.id);
    if (transaction.is_split && splits?.length) {
      splits.forEach((split) => {
        if (split.amount > 0) {
          totalIncome += split.amount;
        } else if (split.amount < 0) {
          const absAmount = Math.abs(split.amount);
          totalExpenses += absAmount;
          const categoryName = Array.isArray(split.category)
            ? split.category[0]?.name || 'Uncategorized'
            : split.category?.name || 'Uncategorized';
          const current = expensesByPayee.get(transaction.payee) || {
            amount: 0,
            category: categoryName,
          };
          current.amount += absAmount;
          expensesByPayee.set(transaction.payee, current);
        }
      });
      return;
    }

    if (transaction.amount > 0) {
      totalIncome += transaction.amount;
    } else {
      const absAmount = Math.abs(transaction.amount);
      totalExpenses += absAmount;

      const current = expensesByPayee.get(transaction.payee) || {
        amount: 0,
        category: transaction.category?.name || 'Uncategorized',
      };
      current.amount += absAmount;
      expensesByPayee.set(transaction.payee, current);
    }
  });

  const topExpenses = Array.from(expensesByPayee.entries())
    .map(([payee, data]) => ({
      payee,
      amount: data.amount,
      category: data.category,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const unreviewed = transactions.filter(
    (transaction) => !isReviewApproved(transaction.review_status)
  ).length;

  return {
    week_start: weekStart,
    week_end: weekEnd,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_change: totalIncome - totalExpenses,
    transaction_count: transactions.length,
    unreviewed_count: unreviewed,
    top_expenses: topExpenses,
  };
}

/**
 * Helper to get interval key for grouping
 */
function getIntervalKey(date: string, interval: 'day' | 'week' | 'month'): string {
  const d = new Date(date);
  
  if (interval === 'day') {
    return date;
  }
  
  if (interval === 'week') {
    const dayOfWeek = d.getDay();
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - dayOfWeek);
    return weekStart.toISOString().split('T')[0];
  }
  
  // month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
