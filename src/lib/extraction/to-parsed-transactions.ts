import { ParsedTransaction } from '@/types'

interface ExtractedTransactionInput {
  date: string
  description: string
  amount: number
  raw_amount?: number
  card?: string
  type?: string
}

/**
 * Convert extracted statement transactions (already sign-normalized)
 * into ParsedTransaction[] that can be fed into the CSV import pipeline.
 *
 * This bridges PDF extraction → prepareCsvTransactions(), giving PDF-created
 * transactions the same full field set as CSV-imported ones (source_hash,
 * payee normalization, AI categorization, import tracking, etc.).
 */
export function toParsedTransactions(
  extractedTxns: ExtractedTransactionInput[],
  sourceSystem: string = 'pdf_statement'
): ParsedTransaction[] {
  return extractedTxns.map((txn) => ({
    date: txn.date,
    payee: txn.description || 'Unknown',
    description: txn.card ? `Card: ${txn.card}` : null,
    memo: txn.type || null,
    amount: txn.amount, // Already normalized to DB convention
    category: null,
    reference: null,
    bank_status: null,
    reconciliation_status: null,
    bank_status_raw: null,
    source_system: sourceSystem as any,
    raw_data: {
      date: txn.date,
      description: txn.description,
      amount: String(txn.amount),
      raw_amount: String(txn.raw_amount ?? txn.amount),
      card: txn.card || '',
      type: txn.type || '',
      source: 'pdf_statement',
    },
  }))
}
