import { StatementProfile } from './statement-profiles'

export interface RawExtractedTransaction {
  date: string
  description: string
  amount: number
  raw_amount?: number
  card?: string
  type?: 'payment' | 'credit' | 'purchase' | 'interest'
}

export interface RawStatementExtraction {
  account_type: string
  account_number_last4: string | null
  period_start: string
  period_end: string
  beginning_balance: number
  ending_balance: number
  summary?: {
    payments_credits?: number
    new_charges?: number
    fees?: number
    interest?: number
  }
  transactions: RawExtractedTransaction[]
  _extraction_method?: string
  _pages_processed?: number
  _validation?: { valid: boolean; warnings: string[] }
}

/**
 * Extraction provider interface. Implementations extract structured
 * statement data from PDF page images.
 */
export interface ExtractionProvider {
  name: string
  extractStatement(
    pageImages: string[],
    profile: StatementProfile
  ): Promise<RawStatementExtraction | null>
}
