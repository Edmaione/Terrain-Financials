import type { QBAccountClassification, QBRow } from './types';
import type { Account, Category } from '@/types';

/** Known QB special accounts that are bank-like */
const BANK_LIKE_ACCOUNTS = new Set([
  'undeposited funds',
  'accounts receivable',
  'accounts payable',
  'a/r',
  'a/p',
]);

/** Pattern: institution name + 4-digit number */
const BANK_NUMBER_PATTERN = /\d{4}/;

/** Known institution keywords */
const INSTITUTION_KEYWORDS = [
  'bank', 'chase', 'citi', 'amex', 'wells fargo', 'bofa', 'capital one',
  'us bank', 'dcu', 'sheffield', 'relay', 'mercury', 'brex', 'ramp',
  'american express', 'discover',
];

/** Category keywords */
const CATEGORY_KEYWORDS = [
  'expense', 'income', 'cost', 'materials', 'supplies', 'labor',
  'insurance', 'tax', 'depreciation', 'advertising', 'utilities',
  'rent', 'interest', 'fee', 'service', 'revenue', 'sales',
  'wages', 'salary', 'commission', 'repair', 'maintenance',
];

function stripDeleted(name: string): { cleaned: string; isDeleted: boolean } {
  const match = name.match(/^(.+?)\s*\(deleted\)\s*$/i);
  if (match) return { cleaned: match[1].trim(), isDeleted: true };
  return { cleaned: name, isDeleted: false };
}

function inferCategoryType(name: string): 'income' | 'cogs' | 'expense' | 'other_income' | 'other_expense' {
  const lower = name.toLowerCase();
  if (lower.includes('income') || lower.includes('revenue') || lower.includes('sales')) {
    if (lower.includes('other')) return 'other_income';
    return 'income';
  }
  if (lower.includes('job materials') || lower.includes('cost of') || lower.startsWith('cogs')) return 'cogs';
  if (lower.includes('other expense') || lower.includes('interest expense')) return 'other_expense';
  return 'expense';
}

function inferAccountType(name: string): 'checking' | 'credit_card' | 'loan' | 'savings' {
  const lower = name.toLowerCase();
  if (lower.includes('credit') || lower.includes('amex') || lower.includes('card')) return 'credit_card';
  if (lower.includes('loan') || lower.includes('note payable')) return 'loan';
  if (lower.includes('saving')) return 'savings';
  return 'checking';
}

/**
 * Extract all unique account names from QB rows and classify each as
 * bank_account or category.
 */
export function classifyQBAccounts(
  rows: QBRow[],
  existingAccounts: Account[],
  existingCategories: Category[]
): QBAccountClassification[] {
  // Collect unique names
  const names = new Set<string>();
  for (const row of rows) {
    if (row.PrimaryDebitAccount) names.add(row.PrimaryDebitAccount.trim());
    if (row.PrimaryCreditAccount) names.add(row.PrimaryCreditAccount.trim());
  }

  // Index existing entities
  const accountsByName = new Map<string, Account>();
  for (const a of existingAccounts) {
    accountsByName.set(a.name.toLowerCase(), a);
  }
  const categoriesByName = new Map<string, Category>();
  const categoriesByQB = new Map<string, Category>();
  for (const c of existingCategories) {
    categoriesByName.set(c.name.toLowerCase(), c);
    if (c.qb_equivalent) categoriesByQB.set(c.qb_equivalent.toLowerCase(), c);
  }

  const results: QBAccountClassification[] = [];

  for (const rawName of names) {
    const { cleaned, isDeleted } = stripDeleted(rawName);
    const lower = cleaned.toLowerCase();

    // Check: matches existing system account
    const matchedAccount = accountsByName.get(lower);
    if (matchedAccount) {
      results.push({
        qbName: rawName,
        type: 'bank_account',
        confidence: 1.0,
        systemId: matchedAccount.id,
        isDeleted,
        originalName: isDeleted ? cleaned : undefined,
      });
      continue;
    }

    // Check: matches existing category by name or qb_equivalent
    const matchedCat = categoriesByName.get(lower) || categoriesByQB.get(lower);
    if (matchedCat) {
      results.push({
        qbName: rawName,
        type: 'category',
        confidence: 1.0,
        systemId: matchedCat.id,
        suggestedCategoryType: matchedCat.type,
        isDeleted,
        originalName: isDeleted ? cleaned : undefined,
      });
      continue;
    }

    // Heuristic: colon hierarchy → category
    if (cleaned.includes(':')) {
      results.push({
        qbName: rawName,
        type: 'category',
        confidence: 0.95,
        suggestedCategoryType: inferCategoryType(cleaned),
        isDeleted,
        originalName: isDeleted ? cleaned : undefined,
      });
      continue;
    }

    // Heuristic: bank-like special accounts
    if (BANK_LIKE_ACCOUNTS.has(lower)) {
      results.push({
        qbName: rawName,
        type: 'bank_account',
        confidence: 0.9,
        suggestedAccountType: 'checking',
        isDeleted,
        originalName: isDeleted ? cleaned : undefined,
      });
      continue;
    }

    // Heuristic: 4-digit number pattern (bank account number)
    if (BANK_NUMBER_PATTERN.test(cleaned)) {
      const hasInstitution = INSTITUTION_KEYWORDS.some(kw => lower.includes(kw));
      results.push({
        qbName: rawName,
        type: 'bank_account',
        confidence: hasInstitution ? 0.95 : 0.8,
        suggestedAccountType: inferAccountType(cleaned),
        isDeleted,
        originalName: isDeleted ? cleaned : undefined,
      });
      continue;
    }

    // Heuristic: institution keyword without number
    if (INSTITUTION_KEYWORDS.some(kw => lower.includes(kw))) {
      results.push({
        qbName: rawName,
        type: 'bank_account',
        confidence: 0.7,
        suggestedAccountType: inferAccountType(cleaned),
        isDeleted,
        originalName: isDeleted ? cleaned : undefined,
      });
      continue;
    }

    // Heuristic: category keywords
    if (CATEGORY_KEYWORDS.some(kw => lower.includes(kw))) {
      results.push({
        qbName: rawName,
        type: 'category',
        confidence: 0.8,
        suggestedCategoryType: inferCategoryType(cleaned),
        isDeleted,
        originalName: isDeleted ? cleaned : undefined,
      });
      continue;
    }

    // Default: assume category (most QB GL accounts are categories)
    results.push({
      qbName: rawName,
      type: 'category',
      confidence: 0.5,
      suggestedCategoryType: inferCategoryType(cleaned),
      isDeleted,
      originalName: isDeleted ? cleaned : undefined,
    });
  }

  return results.sort((a, b) => a.qbName.localeCompare(b.qbName));
}
