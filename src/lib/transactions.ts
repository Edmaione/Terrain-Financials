export const NEEDS_CATEGORIZATION_LABEL = 'Needs categorization'

type TransactionCategoryRelationship = {
  name?: string | null
  section?: string | null
}

type TransactionCategoryDisplayInput = {
  category_id?: string | null
  primary_category_id?: string | null
  subcategory_id?: string | null
  category?: TransactionCategoryRelationship | null
  primary_category?: TransactionCategoryRelationship | null
  subcategory?: TransactionCategoryRelationship | null
}

export function getCategoryDisplayLabel(transaction: TransactionCategoryDisplayInput): string {
  const resolvedCategory =
    transaction.primary_category || transaction.category || transaction.subcategory || null
  const resolvedName = resolvedCategory?.name?.trim() ?? ''
  const hasInternalCategory = Boolean(
    transaction.primary_category_id || transaction.category_id || transaction.subcategory_id
  )

  if (hasInternalCategory && resolvedName) {
    return resolvedName
  }

  return NEEDS_CATEGORIZATION_LABEL
}
