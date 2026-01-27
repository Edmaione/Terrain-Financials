import { supabaseAdmin } from '@/lib/supabase/admin';
import type { QBAccountMap, QBAccountClassification } from './types';
import type { Account, Category, AccountType, CategoryType } from '@/types';

/**
 * Auto-create missing accounts and categories based on QB classifications
 * and user-confirmed mappings. Returns the updated account map with systemIds filled in.
 */
export async function autoCreateEntities(
  accountMap: QBAccountMap,
  classifications: QBAccountClassification[]
): Promise<{
  accountMap: QBAccountMap;
  createdAccounts: number;
  createdCategories: number;
}> {
  const updated = { ...accountMap };
  let createdAccounts = 0;
  let createdCategories = 0;

  // Index classifications by name for metadata
  const classMap = new Map<string, QBAccountClassification>();
  for (const c of classifications) classMap.set(c.qbName, c);

  // Fetch existing data for parent lookups
  const { data: existingCategories } = await supabaseAdmin
    .from('categories')
    .select('id, name, parent_id, type');

  const catByName = new Map<string, Category>();
  for (const c of (existingCategories || []) as Category[]) {
    catByName.set(c.name.toLowerCase(), c);
  }

  for (const [qbName, mapping] of Object.entries(updated)) {
    if (mapping.systemId) continue; // Already mapped

    const cls = classMap.get(qbName);
    const isDeleted = cls?.isDeleted ?? false;

    if (mapping.type === 'bank_account') {
      const createAs = mapping.createAs;
      const cleanName = cls?.originalName || qbName.replace(/\s*\(deleted\)\s*$/i, '');

      const { data: newAccount, error } = await supabaseAdmin
        .from('accounts')
        .insert({
          name: createAs?.name || cleanName,
          type: (createAs?.accountType || cls?.suggestedAccountType || 'checking') as AccountType,
          institution: createAs?.institution || '',
          is_active: !isDeleted,
          opening_balance: 0,
          current_balance: 0,
        })
        .select('id')
        .single();

      if (!error && newAccount) {
        updated[qbName] = { ...mapping, systemId: newAccount.id };
        createdAccounts++;
      }
    } else {
      // Category - parse colon hierarchy
      const createAs = mapping.createAs;
      const cleanName = cls?.originalName || qbName.replace(/\s*\(deleted\)\s*$/i, '');
      const parts = cleanName.split(':').map(p => p.trim());

      let parentId: string | undefined;
      let categoryType = (createAs?.categoryType || cls?.suggestedCategoryType || 'expense') as CategoryType;

      if (parts.length > 1) {
        // Find or create parent
        const parentName = parts[0];
        const existingParent = catByName.get(parentName.toLowerCase());
        if (existingParent) {
          parentId = existingParent.id;
          // Inherit type from parent if not explicitly set
          if (!createAs?.categoryType && !cls?.suggestedCategoryType) {
            categoryType = existingParent.type;
          }
        } else {
          // Create parent
          const parentType = inferCategoryType(parentName);
          const { data: newParent, error } = await supabaseAdmin
            .from('categories')
            .insert({
              name: parentName,
              type: parentType,
              is_tax_deductible: parentType !== 'income',
              qb_equivalent: parentName,
              sort_order: 999,
            })
            .select('id, name, type')
            .single();

          if (!error && newParent) {
            parentId = newParent.id;
            categoryType = newParent.type as CategoryType;
            catByName.set(parentName.toLowerCase(), newParent as Category);
            createdCategories++;
          }
        }
      }

      const leafName = parts[parts.length - 1];
      // Check if leaf already exists under parent
      const existingLeaf = catByName.get(leafName.toLowerCase());
      if (existingLeaf && (!parentId || existingLeaf.parent_id === parentId)) {
        updated[qbName] = { ...mapping, systemId: existingLeaf.id };
        continue;
      }

      const { data: newCat, error } = await supabaseAdmin
        .from('categories')
        .insert({
          name: leafName,
          parent_id: parentId || null,
          type: categoryType,
          is_tax_deductible: categoryType !== 'income',
          qb_equivalent: cleanName,
          sort_order: 999,
        })
        .select('id, name, type')
        .single();

      if (!error && newCat) {
        updated[qbName] = { ...mapping, systemId: newCat.id };
        catByName.set(leafName.toLowerCase(), newCat as Category);
        createdCategories++;
      }
    }
  }

  return { accountMap: updated, createdAccounts, createdCategories };
}

function inferCategoryType(name: string): CategoryType {
  const lower = name.toLowerCase();
  if (lower.includes('income') || lower.includes('revenue') || lower.includes('sales')) {
    if (lower.includes('other')) return 'other_income';
    return 'income';
  }
  if (lower.includes('job materials') || lower.includes('cost of') || lower.startsWith('cogs')) return 'cogs';
  if (lower.includes('other expense') || lower.includes('interest expense')) return 'other_expense';
  return 'expense';
}
