import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase';
import { suggestCategory } from './openai';
import { Transaction, Category, CategorizationRule } from '@/types';

/**
 * Normalize a payee name for fuzzy matching
 * "AMAZON.COM*ABC123" → "amazon"
 * "THE HOME DEPOT #1234" → "home depot"
 */
export function normalizePayee(payee: string): string {
  return payee
    .toLowerCase()
    // Remove common suffixes with numbers (order IDs, store numbers, etc.)
    .replace(/[*#]\s*[a-z0-9]+$/i, '')
    .replace(/\s*#\d+$/i, '')
    .replace(/\s*\d{4,}$/i, '')
    // Remove common prefixes
    .replace(/^(the|a|an)\s+/i, '')
    // Remove special characters but keep spaces
    .replace(/[^a-z0-9\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two normalized strings (0-1)
 * Uses a simple contains-based approach + prefix matching
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;

  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;

  // Exact substring match
  if (longer.includes(shorter)) {
    return 0.9 * (shorter.length / longer.length) + 0.1;
  }

  // Check if all words in shorter are in longer
  const shorterWords = shorter.split(' ').filter(w => w.length > 0);
  const longerWords = longer.split(' ').filter(w => w.length > 0);

  if (shorterWords.length > 0) {
    const matchedWords = shorterWords.filter(sw =>
      longerWords.some(lw => lw.includes(sw) || sw.includes(lw))
    );
    if (matchedWords.length === shorterWords.length) {
      return 0.85;
    }
    if (matchedWords.length > 0) {
      return 0.5 * (matchedWords.length / shorterWords.length);
    }
  }

  return 0;
}

/**
 * Find a fuzzy match rule for a payee
 */
async function findFuzzyMatchRule(
  payee: string
): Promise<CategorizationRule | null> {
  const normalizedPayee = normalizePayee(payee);

  if (!normalizedPayee) return null;

  // First try to find by normalized pattern
  const { data: normalizedRules } = await supabaseAdmin
    .from('categorization_rules')
    .select('*')
    .eq('is_active', true)
    .not('payee_pattern_normalized', 'is', null)
    .order('confidence', { ascending: false });

  if (normalizedRules && normalizedRules.length > 0) {
    let bestMatch: CategorizationRule | null = null;
    let bestScore = 0;

    for (const rule of normalizedRules) {
      const score = calculateSimilarity(normalizedPayee, rule.payee_pattern_normalized || '');
      // Require at least 70% similarity and factor in confidence
      if (score >= 0.7 && score * rule.confidence > bestScore) {
        bestScore = score * rule.confidence;
        bestMatch = rule;
      }
    }

    if (bestMatch && bestScore >= 0.6) {
      return bestMatch;
    }
  }

  // Fallback: try contains matching on original patterns
  const { data: allRules } = await supabaseAdmin
    .from('categorization_rules')
    .select('*')
    .eq('is_active', true)
    .order('confidence', { ascending: false });

  if (!allRules) return null;

  for (const rule of allRules) {
    const ruleNormalized = normalizePayee(rule.payee_pattern);
    const score = calculateSimilarity(normalizedPayee, ruleNormalized);

    if (score >= 0.7) {
      return rule;
    }
  }

  return null;
}

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

  // Step 2: Try fuzzy match rules (new step)
  const fuzzyMatch = await findFuzzyMatchRule(transaction.payee);
  if (fuzzyMatch) {
    await incrementRuleUsage(fuzzyMatch.id);
    // Slightly reduce confidence for fuzzy matches
    const adjustedConfidence = Math.min(fuzzyMatch.confidence * 0.9, 0.90);
    return {
      category_id: fuzzyMatch.category_id,
      subcategory_id: fuzzyMatch.subcategory_id || null,
      confidence: adjustedConfidence,
      rule_id: fuzzyMatch.id,
    };
  }

  // Step 3: Try pattern match rules
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

  // Step 4: Use AI to suggest category
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
  const normalizedPattern = normalizePayee(payee);

  // Check if rule already exists for this normalized payee and category
  const { data: existing } = await supabaseAdmin
    .from('categorization_rules')
    .select('*')
    .eq('payee_pattern_normalized', normalizedPattern)
    .eq('category_id', category_id)
    .single();

  if (existing) {
    // Rule already exists, increment usage and track correctness
    await incrementRuleCorrect(existing.id);
    return;
  }

  // Check if rule exists for this normalized payee with different category
  const { data: conflicting } = await supabaseAdmin
    .from('categorization_rules')
    .select('*')
    .eq('payee_pattern_normalized', normalizedPattern)
    .neq('category_id', category_id)
    .order('confidence', { ascending: false })
    .limit(1)
    .single();

  if (conflicting) {
    // Existing rule was wrong, decrement its confidence
    await incrementRuleWrong(conflicting.id);
  }

  // Create new rule with moderate confidence (not 0.95)
  await supabaseAdmin.from('categorization_rules').insert({
    payee_pattern: payee,
    payee_pattern_normalized: normalizedPattern,
    description_pattern: description || null,
    category_id,
    subcategory_id: subcategory_id || null,
    confidence: 0.85, // Start lower, let accuracy build trust
    times_applied: 1,
    times_correct: 1,
    times_wrong: 0,
    last_used: new Date().toISOString(),
    created_by: 'user',
  });
}

/**
 * Increment correct count and increase confidence
 */
async function incrementRuleCorrect(ruleId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('categorization_rules')
    .select('times_applied, times_correct, times_wrong, confidence')
    .eq('id', ruleId)
    .single();

  if (error || !data) {
    console.error('Failed to fetch rule for correct increment', error);
    return;
  }

  const timesCorrect = (data.times_correct ?? 0) + 1;
  const timesApplied = (data.times_applied ?? 0) + 1;
  const timesWrong = data.times_wrong ?? 0;

  // Calculate new confidence based on accuracy
  const totalFeedback = timesCorrect + timesWrong;
  let newConfidence = data.confidence ?? 0.85;
  if (totalFeedback > 0) {
    const accuracy = timesCorrect / totalFeedback;
    // Blend current confidence with accuracy, weighted towards accuracy over time
    newConfidence = Math.min(0.98, data.confidence * 0.7 + accuracy * 0.3);
  }

  await supabaseAdmin
    .from('categorization_rules')
    .update({
      times_applied: timesApplied,
      times_correct: timesCorrect,
      confidence: newConfidence,
      last_used: new Date().toISOString(),
    })
    .eq('id', ruleId);
}

/**
 * Increment wrong count and decrease confidence
 */
export async function incrementRuleWrong(ruleId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('categorization_rules')
    .select('times_wrong, times_correct, confidence, is_active')
    .eq('id', ruleId)
    .single();

  if (error || !data) {
    console.error('Failed to fetch rule for wrong increment', error);
    return;
  }

  const timesWrong = (data.times_wrong ?? 0) + 1;
  const timesCorrect = data.times_correct ?? 0;

  // Calculate new confidence
  const totalFeedback = timesCorrect + timesWrong;
  let newConfidence = data.confidence ?? 0.85;
  if (totalFeedback > 0) {
    const accuracy = timesCorrect / totalFeedback;
    newConfidence = Math.max(0.1, data.confidence * 0.7 + accuracy * 0.3);
  } else {
    // Decrease confidence by 10% for each wrong
    newConfidence = Math.max(0.1, data.confidence * 0.9);
  }

  // Archive rules with very low confidence
  const shouldArchive = newConfidence < 0.5;

  await supabaseAdmin
    .from('categorization_rules')
    .update({
      times_wrong: timesWrong,
      confidence: newConfidence,
      is_active: shouldArchive ? false : data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ruleId);
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
 * Now fetches 20 transactions for better pattern recognition
 */
async function getHistoricalTransactionsForPayee(
  payee: string
): Promise<Array<Transaction & { category: Category | null }>> {
  const normalizedPayee = normalizePayee(payee);
  const searchTerms = normalizedPayee.split(' ').filter(t => t.length > 2);

  // First try exact-ish match
  let { data } = await supabaseAdmin
    .from('transactions')
    .select(`
      *,
      category:categories!category_id(*)
    `)
    .ilike('payee', `%${payee}%`)
    .not('category_id', 'is', null)
    .eq('review_status', 'approved')
    .order('date', { ascending: false })
    .limit(20);

  // If not enough results, try normalized search terms
  if ((!data || data.length < 5) && searchTerms.length > 0) {
    const fuzzyResults = await supabaseAdmin
      .from('transactions')
      .select(`
        *,
        category:categories!category_id(*)
      `)
      .ilike('payee', `%${searchTerms[0]}%`)
      .not('category_id', 'is', null)
      .eq('review_status', 'approved')
      .order('date', { ascending: false })
      .limit(20);

    if (fuzzyResults.data && fuzzyResults.data.length > (data?.length || 0)) {
      data = fuzzyResults.data;
    }
  }

  return data || [];
}

/**
 * Increment usage count for a rule
 */
async function incrementRuleUsage(ruleId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('categorization_rules')
    .select('times_applied')
    .eq('id', ruleId)
    .single();

  if (error) {
    console.error('Failed to fetch rule usage count', error);
    return;
  }

  const nextTimesApplied = (data?.times_applied ?? 0) + 1;
  const { error: updateError } = await supabaseAdmin
    .from('categorization_rules')
    .update({
      times_applied: nextTimesApplied,
      last_used: new Date().toISOString(),
    })
    .eq('id', ruleId);

  if (updateError) {
    console.error('Failed to increment rule usage count', updateError);
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

export async function detectAndPairTransfers(accountId: string, date: string) {
  const { data: sourceTransactions, error: sourceError } = await supabaseAdmin
    .from('transactions')
    .select('id, amount, account_id, transfer_group_id, is_transfer')
    .eq('account_id', accountId)
    .eq('date', date)
    .is('transfer_group_id', null)
    .is('deleted_at', null);

  if (sourceError || !sourceTransactions || sourceTransactions.length === 0) {
    if (sourceError) {
      console.error('[transfers] Failed to fetch source transactions', sourceError);
    }
    return [];
  }

  const { data: candidateTransactions, error: candidateError } = await supabaseAdmin
    .from('transactions')
    .select('id, amount, account_id, transfer_group_id, is_transfer')
    .neq('account_id', accountId)
    .eq('date', date)
    .is('transfer_group_id', null)
    .is('deleted_at', null);

  if (candidateError || !candidateTransactions || candidateTransactions.length === 0) {
    if (candidateError) {
      console.error('[transfers] Failed to fetch candidate transactions', candidateError);
    }
    return [];
  }

  const usedCandidates = new Set<string>();
  const paired: Array<{ source_id: string; paired_id: string }> = [];

  for (const source of sourceTransactions) {
    const match = candidateTransactions.find(
      (candidate) =>
        !usedCandidates.has(candidate.id) &&
        Math.abs(source.amount + candidate.amount) < 0.01
    );

    if (!match) {
      continue;
    }

    usedCandidates.add(match.id);
    paired.push({ source_id: source.id, paired_id: match.id });

    const transferGroupId = randomUUID();

    await Promise.all([
      supabaseAdmin
        .from('transactions')
        .update({
          is_transfer: true,
          transfer_group_id: transferGroupId,
          transfer_to_account_id: match.account_id,
        })
        .eq('id', source.id),
      supabaseAdmin
        .from('transactions')
        .update({
          is_transfer: true,
          transfer_group_id: transferGroupId,
          transfer_to_account_id: source.account_id,
        })
        .eq('id', match.id),
    ]);
  }

  return paired;
}
