import { AccountType } from '@/types'

/**
 * Normalize a raw amount extracted from a statement into DB convention.
 *
 * Statements print amounts in "statement convention":
 * - Credit cards: charges are positive, payments/credits are negative
 * - Checking/savings: deposits are positive, withdrawals are negative
 *
 * DB convention (internal):
 * - Money OUT (expenses, charges) = negative
 * - Money IN (income, payments to CC, deposits) = positive
 *
 * For checking/savings, statement convention already matches DB convention.
 * For credit cards, we flip: statement positive (charge) → DB negative (expense).
 */
export function normalizeStatementAmount(
  rawAmount: number,
  accountType: AccountType,
  _txnType?: 'payment' | 'credit' | 'purchase' | 'interest' | string
): number {
  if (accountType === 'credit_card') {
    // Credit card statements: positive = charge, negative = payment/credit
    // DB convention: charge = negative, payment = positive
    // So flip the sign
    return -rawAmount
  }

  // Checking, savings, loan, investment: statement convention matches DB convention
  return rawAmount
}

/**
 * Normalize statement balances for reconciliation math.
 *
 * Credit card statements show balances as positive (amount owed).
 * Internally, credit card balances are negative (liability).
 */
export function normalizeStatementBalance(
  rawBalance: number,
  accountType: AccountType
): number {
  if (accountType === 'credit_card') {
    return -rawBalance
  }
  return rawBalance
}
