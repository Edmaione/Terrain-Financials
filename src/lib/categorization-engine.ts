import { supabaseAdmin } from './supabase';
import { suggestCategory } from './openai';
import { Transaction, Category, CategorizationRule } from '@/types';

/**
 * Categorize a single transaction using rules and AI
 */
export async function categorizeTransaction(
  transaction: Pick<Transaction, 'payee' | 'description' | 'amount'>
): Promise<{
  category_id: string | null;
  subcategory_id?: string | null;
  confidence: number;
  rule_id?: string;
}> {
  // Step 1: Try exact match rules first
  const exactMatch = await findExactMatchRule(transaction.payee);
  if (exactMatch) {
    await incrementRuleUsage(exactMatch.id);
    return {
      category_id: exactMatch.category_id,
      subcategory_id: exactMatch.subcategory_id || null,
      confidence: exactMatch.confidence,
      rule_id: exactMatch.id,
    };
  }

  // Step 2: Try pattern match rules
  const patternMatch = await findPatternMatchRule(transaction.payee, transaction.description);
  if (patternMatch) {
    await incrementRuleUsage(patternMatch.id);
    return {
      category_id: patternMatch.category_id,
      subcategory_id: patternMatch.subcategory_id || null,
      confidence: patternMatch.confidence,
      rule_id: patternMatch.id,
    };
  }

  // Step 3: Use AI to suggest category
  const categories = await getAllCategories();
  const historicalTransactions = await getHistoricalTransactionsForPayee(transaction.payee);

  const suggestion = await suggestCategory(
    transaction.payee,
    transaction.description,
    transaction.amount,
    categories.map(c => ({
      id: c.id,
      name: c.name,
      section: c.section || '',
    })),
    historicalTransactions.map(t => ({
      payee: t.payee,
      category: t.category?.name || 'Uncategorized',
    }))
  );

  if (suggestion) {
    const category = categories.find(c => c.name === suggestion.category_name);
    if (category) {
      return {
        category_id: category.id,
        confidence: suggestion.confidence,
      };
    }
  }

  return {
    category_id: null,
    confidence: 0,
  };
}

/**
 * Batch categorize multiple transactions
 */
export async function batchCategorizeTransactions(
  transactions: Array<Pick<Transaction, 'id' | 'payee' | 'description' | 'amount'>>
): Promise<Map<string, { category_id: string; confidence: number }>> {
  const results = new Map();

  // Process each transaction
  for (const transaction of transactions) {
    const result = await categorizeTransaction(transaction);
    if (result.category_id) {
      results.set(transaction.id, {
        category_id: result.category_id,
        confidence: result.confidence,
      });
    }
  }

  return results;
}

/**
 * Create a new categorization rule from user approval
 */
export async function createRuleFromApproval(
  payee: string,
  description: string | undefined,
  category_id: string,
  subcategory_id?: string
): Promise<void> {
  // Check if rule already exists
  const { data: existing } = await supabaseAdmin
    .from('categorization_rules')
    .select('*')
    .eq('payee_pattern', payee)
    .eq('category_id', category_id)
    .single();

  if (existing) {
    // Rule already exists, just increment usage
    await incrementRuleUsage(existing.id);
    return;
  }

  // Create new rule
  await supabaseAdmin.from('categorization_rules').insert({
    payee_pattern: payee,
    description_pattern: description || null,
    category_id,
    subcategory_id: subcategory_id || null,
    confidence: 0.95,
    times_applied: 1,
    last_used: new Date().toISOString(),
    created_by: 'user',
  });
}

/**
 * Find exact match rule for payee
 */
async function findExactMatchRule(payee: string): Promise<CategorizationRule | null> {
  const { data } = await supabaseAdmin
    .from('categorization_rules')
    .select('*')
    .eq('is_active', true)
    .eq('payee_pattern', payee)
    .order('confidence', { ascending: false })
    .limit(1)
    .single();

  return data;
}

/**
 * Find pattern match rule using regex
 */
async function findPatternMatchRule(
  payee: string,
  description?: string
): Promise<CategorizationRule | null> {
  const { data: rules } = await supabaseAdmin
    .from('categorization_rules')
    .select('*')
    .eq('is_active', true)
    .order('confidence', { ascending: false });

  if (!rules) return null;

  // Test each rule's pattern
  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.payee_pattern, 'i');
      if (regex.test(payee)) {
        // If rule has description pattern, check that too
        if (rule.description_pattern && description) {
          const descRegex = new RegExp(rule.description_pattern, 'i');
          if (descRegex.test(description)) {
            return rule;
          }
        } else if (!rule.description_pattern) {
          return rule;
        }
      }
    } catch (error) {
      // Invalid regex, skip
      console.warn(`Invalid regex pattern: ${rule.payee_pattern}`);
    }
  }

  return null;
}

/**
 * Get all active categories
 */
async function getAllCategories(): Promise<Category[]> {
  const { data } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('sort_order');

  return data || [];
}

/**
 * Get historical transactions for a payee to help AI learn patterns
 */
async function getHistoricalTransactionsForPayee(
  payee: string
): Promise<Array<Transaction & { category: Category | null }>> {
  const { data } = await supabaseAdmin
    .from('transactions')
    .select(`
      *,
      category:categories!category_id(*)
    `)
    .ilike('payee', `%${payee}%`)
    .not('category_id', 'is', null)
    .order('date', { ascending: false })
    .limit(10);

  return data || [];
}

/**
 * Increment usage count for a rule
 */
async function incrementRuleUsage(ruleId: string): Promise<void> {
  // Fetch current rule
  const { data: rule } = await supabaseAdmin
    .from('categorization_rules')
    .select('times_applied')
    .eq('id', ruleId)
    .single();

  if (rule) {
    // Update with incremented value
    await supabaseAdmin
      .from('categorization_rules')
      .update({
        times_applied: (rule.times_applied || 0) + 1,
        last_used: new Date().toISOString(),
      })
      .eq('id', ruleId);
  }
}

/**
 * Smart detection of specific transaction types
 */
export function detectTransactionType(
  payee: string,
  description: string | undefined,
  reference: string | undefined
): {
  isPayroll: boolean;
  payrollType?: 'wages' | 'taxes' | 'fees';
  isInsurance: boolean;
  isUtility: boolean;
} {
  const lowerPayee = payee.toLowerCase();
  const lowerDesc = (description || '').toLowerCase();
  const lowerRef = (reference || '').toLowerCase();

  // Detect Gusto payroll
  const isPayroll = lowerPayee.includes('gusto');
  let payrollType: 'wages' | 'taxes' | 'fees' | undefined;

  if (isPayroll) {
    if (lowerDesc.includes('tax') || lowerRef.includes('tax')) {
      payrollType = 'taxes';
    } else if (lowerDesc.includes('fee') || lowerRef.includes('fee')) {
      payrollType = 'fees';
    } else if (lowerDesc.includes('net') || lowerRef.includes('net')) {
      payrollType = 'wages';
    }
  }

  // Detect insurance
  const isInsurance = 
    lowerPayee.includes('insur') || 
    lowerPayee.includes('insurance');

  // Detect utilities
  const isUtility = 
    lowerPayee.includes('t-mobile') ||
    lowerPayee.includes('verizon') ||
    lowerPayee.includes('electric') ||
    lowerPayee.includes('gas') ||
    lowerPayee.includes('water');

  return {
    isPayroll,
    payrollType,
    isInsurance,
    isUtility,
  };
}
