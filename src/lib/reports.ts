import { supabaseAdmin } from './supabase';
import { PLReport, PLReportLine, CashFlowData, WeeklySummary } from '@/types';

/**
 * Generate Profit & Loss report for a date range
 */
export async function generatePLReport(
  startDate: string,
  endDate: string
): Promise<PLReport> {
  // Get all transactions in date range with categories
  const { data: transactions } = await supabaseAdmin
    .from('transactions')
    .select(`
      *,
      category:categories!category_id(*),
      subcategory:categories!subcategory_id(*)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('reviewed', true)
    .not('category_id', 'is', null);

  if (!transactions) {
    throw new Error('Failed to fetch transactions');
  }

  // Get all categories
  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('sort_order');

  if (!categories) {
    throw new Error('Failed to fetch categories');
  }

  // Calculate totals by category
  const categoryTotals = new Map<string, number>();
  
  transactions.forEach(t => {
    const categoryId = t.subcategory_id || t.category_id;
    if (categoryId) {
      const current = categoryTotals.get(categoryId) || 0;
      categoryTotals.set(categoryId, current + Math.abs(t.amount));
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
  interval: 'day' | 'week' | 'month' = 'day'
): Promise<CashFlowData[]> {
  const { data: transactions } = await supabaseAdmin
    .from('transactions')
    .select('date, amount')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (!transactions) return [];

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
  weekEnd: string
): Promise<WeeklySummary> {
  const { data: transactions } = await supabaseAdmin
    .from('transactions')
    .select(`
      *,
      category:categories!category_id(*)
    `)
    .gte('date', weekStart)
    .lte('date', weekEnd);

 if (!transactions) {
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

  let totalIncome = 0;
  let totalExpenses = 0;
  const expensesByPayee = new Map<string, { amount: number; category: string }>();

  transactions.forEach(t => {
    if (t.amount > 0) {
      totalIncome += t.amount;
    } else {
      const absAmount = Math.abs(t.amount);
      totalExpenses += absAmount;
      
      const current = expensesByPayee.get(t.payee) || { amount: 0, category: t.category?.name || 'Uncategorized' };
      current.amount += absAmount;
      expensesByPayee.set(t.payee, current);
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

  const unreviewed = transactions.filter(t => !t.reviewed).length;

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
