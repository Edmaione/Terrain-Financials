import { AccountType } from '@/types'

export type CheckSeverity = 'pass' | 'warn' | 'fail'

export interface ValidationCheck {
  name: string
  severity: CheckSeverity
  message: string
}

export interface ValidationResult {
  overall: CheckSeverity
  checks: ValidationCheck[]
}

interface ExtractedTransactionForValidation {
  date: string
  description: string
  amount: number
  card?: string | null
  type?: string
}

interface ExtractionForValidation {
  account_type?: string
  beginning_balance?: number
  ending_balance?: number
  period_start?: string
  period_end?: string
  summary?: {
    payments_credits?: number
    new_charges?: number
    fees?: number
    interest?: number
  }
  transactions?: ExtractedTransactionForValidation[]
}

const AMEX_VALID_CARDHOLDERS = new Set([
  'EDWARD MAIONE JR',
  'DUMP ONE',
  'FERT ONE',
  'BOX TWO',
  'JACOB PELOQUIN',
  'EDWARD MAIONE JR BI',
])

/**
 * Validate extracted statement data before user review.
 * All amounts should be in as-printed (statement) convention.
 */
export function validateExtraction(
  data: ExtractionForValidation,
  accountType?: AccountType
): ValidationResult {
  const checks: ValidationCheck[] = []
  const txns = data.transactions || []

  // 1. Balance reconciliation: beginning + txn sum ≈ ending
  if (data.beginning_balance != null && data.ending_balance != null && txns.length > 0) {
    const txnSum = txns.reduce((sum, t) => sum + (t.amount || 0), 0)
    const expectedEnding = data.beginning_balance + txnSum

    const tolerance = Math.abs(data.ending_balance) * 0.005 + 1 // 0.5% + $1
    const diff = Math.abs(expectedEnding - data.ending_balance)

    if (diff <= tolerance) {
      checks.push({
        name: 'balance_reconciliation',
        severity: 'pass',
        message: `Balance reconciles: ${data.beginning_balance.toFixed(2)} + ${txnSum.toFixed(2)} = ${expectedEnding.toFixed(2)} (ending: ${data.ending_balance.toFixed(2)})`,
      })
    } else if (diff <= tolerance * 3) {
      checks.push({
        name: 'balance_reconciliation',
        severity: 'warn',
        message: `Balance close but off by $${diff.toFixed(2)}: ${data.beginning_balance.toFixed(2)} + ${txnSum.toFixed(2)} = ${expectedEnding.toFixed(2)}, expected ${data.ending_balance.toFixed(2)}`,
      })
    } else {
      checks.push({
        name: 'balance_reconciliation',
        severity: 'fail',
        message: `Balance mismatch of $${diff.toFixed(2)}: ${data.beginning_balance.toFixed(2)} + ${txnSum.toFixed(2)} = ${expectedEnding.toFixed(2)}, expected ${data.ending_balance.toFixed(2)}`,
      })
    }
  }

  // 2. Summary-sum cross-check (if summary data available)
  if (data.summary && txns.length > 0) {
    const txnSum = txns.reduce((sum, t) => sum + (t.amount || 0), 0)
    // In as-printed convention: charges are positive, payments/credits are negative
    // Summary gives: payments_credits (positive number), new_charges (positive), interest (positive)
    // Expected txn sum = -payments_credits + new_charges + interest + fees
    const expectedSum = -(data.summary.payments_credits || 0) + (data.summary.new_charges || 0) + (data.summary.interest || 0) + (data.summary.fees || 0)

    const summaryDiff = Math.abs(txnSum - expectedSum)
    if (summaryDiff <= 2) {
      checks.push({
        name: 'summary_crosscheck',
        severity: 'pass',
        message: `Transaction sum (${txnSum.toFixed(2)}) matches statement summary (${expectedSum.toFixed(2)})`,
      })
    } else {
      checks.push({
        name: 'summary_crosscheck',
        severity: summaryDiff > 50 ? 'fail' : 'warn',
        message: `Transaction sum (${txnSum.toFixed(2)}) differs from statement summary (${expectedSum.toFixed(2)}) by $${summaryDiff.toFixed(2)}`,
      })
    }
  }

  // 3. Date range check
  if (data.period_start && data.period_end && txns.length > 0) {
    const periodStart = new Date(data.period_start).getTime()
    const periodEnd = new Date(data.period_end).getTime()
    const graceDays = 5 * 24 * 60 * 60 * 1000 // 5-day grace for posting delays
    const outOfRange = txns.filter((t) => {
      const d = new Date(t.date).getTime()
      return d < periodStart - graceDays || d > periodEnd + graceDays
    })

    if (outOfRange.length === 0) {
      checks.push({ name: 'date_range', severity: 'pass', message: 'All transactions within statement period' })
    } else {
      const severity = outOfRange.length > 5 ? 'fail' : 'warn'
      checks.push({
        name: 'date_range',
        severity,
        message: `${outOfRange.length} transaction(s) outside statement period (${data.period_start} to ${data.period_end})`,
      })
    }
  }

  // 4. Cardholder validation (Amex-specific)
  const isAmex = data.account_type === 'credit_card' // Could refine with institution check
  if (isAmex && txns.length > 0) {
    const invalidCards = txns.filter(
      (t) => t.card && !AMEX_VALID_CARDHOLDERS.has(t.card.trim().toUpperCase())
    )
    if (invalidCards.length === 0) {
      checks.push({ name: 'cardholders', severity: 'pass', message: 'All cardholders are valid' })
    } else {
      const uniqueInvalid = [...new Set(invalidCards.map((t) => t.card))]
      checks.push({
        name: 'cardholders',
        severity: 'fail',
        message: `${invalidCards.length} transaction(s) with unknown cardholders: ${uniqueInvalid.join(', ')}`,
      })
    }
  }

  // 5. Duplicate detection
  const txnKeys = txns.map((t) => `${t.date}|${t.amount}|${(t.description || '').substring(0, 20).toLowerCase()}`)
  const dupes = txnKeys.filter((key, i) => txnKeys.indexOf(key) !== i)
  if (dupes.length === 0) {
    checks.push({ name: 'duplicates', severity: 'pass', message: 'No duplicate transactions detected' })
  } else {
    checks.push({
      name: 'duplicates',
      severity: 'warn',
      message: `${dupes.length} possible duplicate transaction(s) (same date + amount + description)`,
    })
  }

  // 6. Interest charge count
  const interestTxns = txns.filter(
    (t) => t.type === 'interest' || (t.description || '').toLowerCase().includes('interest charge')
  )
  if (interestTxns.length > 1) {
    checks.push({
      name: 'duplicate_interest',
      severity: 'warn',
      message: `${interestTxns.length} interest charges found — should be exactly 1. Possible double extraction.`,
    })
  } else if (interestTxns.length === 1) {
    checks.push({ name: 'duplicate_interest', severity: 'pass', message: '1 interest charge (correct)' })
  }

  // 7. Count heuristic
  const resolvedType = accountType || (data.account_type as AccountType) || 'checking'
  if (data.period_start && data.period_end) {
    const days = (new Date(data.period_end).getTime() - new Date(data.period_start).getTime()) / (1000 * 60 * 60 * 24)
    const isCC = resolvedType === 'credit_card'
    const expectedMin = isCC ? Math.max(10, days * 0.3) : Math.max(3, days * 0.1)

    if (txns.length < expectedMin) {
      checks.push({
        name: 'transaction_count',
        severity: 'warn',
        message: `Only ${txns.length} transactions for a ${Math.round(days)}-day period (expected at least ${Math.round(expectedMin)})`,
      })
    } else {
      checks.push({
        name: 'transaction_count',
        severity: 'pass',
        message: `${txns.length} transactions for ${Math.round(days)}-day period`,
      })
    }
  }

  // 8. Amount sanity
  const largeThreshold = 10000
  const largeTxns = txns.filter((t) => Math.abs(t.amount) > largeThreshold)
  if (largeTxns.length > 0) {
    checks.push({
      name: 'large_amounts',
      severity: 'warn',
      message: `${largeTxns.length} transaction(s) over $${largeThreshold.toLocaleString()} — verify these are correct`,
    })
  } else {
    checks.push({ name: 'large_amounts', severity: 'pass', message: 'No unusually large transactions' })
  }

  // Compute overall severity
  const hasFail = checks.some((c) => c.severity === 'fail')
  const hasWarn = checks.some((c) => c.severity === 'warn')
  const overall: CheckSeverity = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass'

  return { overall, checks }
}
