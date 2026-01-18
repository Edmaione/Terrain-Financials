export type TransactionFilterInput = {
  reviewStatus?: string
  bankStatus?: string
  reconciliationStatus?: string
  categoryId?: string
  amountMin?: string
  amountMax?: string
  sourceSystem?: string
  importId?: string
  search?: string
}

export type NormalizedTransactionFilters = {
  reviewStatus: string | null
  bankStatus: string | null
  reconciliationStatus: string | null
  categoryId: string | null
  amountMin: number | null
  amountMax: number | null
  sourceSystem: string | null
  importId: string | null
  search: string | null
}

function parseAmount(value?: string) {
  if (!value) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeTransactionFilters(
  input: TransactionFilterInput
): NormalizedTransactionFilters {
  return {
    reviewStatus: input.reviewStatus && input.reviewStatus !== 'all' ? input.reviewStatus : null,
    bankStatus: input.bankStatus && input.bankStatus !== 'all' ? input.bankStatus : null,
    reconciliationStatus:
      input.reconciliationStatus && input.reconciliationStatus !== 'all'
        ? input.reconciliationStatus
        : null,
    categoryId: input.categoryId && input.categoryId.length > 0 ? input.categoryId : null,
    amountMin: parseAmount(input.amountMin),
    amountMax: parseAmount(input.amountMax),
    sourceSystem: input.sourceSystem && input.sourceSystem !== 'all' ? input.sourceSystem : null,
    importId: input.importId && input.importId.length > 0 ? input.importId : null,
    search: input.search?.trim() || null,
  }
}
