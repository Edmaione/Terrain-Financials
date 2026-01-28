/**
 * Post-extraction sanitization.
 *
 * Deterministically fixes common LLM extraction errors that prompts alone
 * can't prevent: hallucinated cardholders, wrong-year dates, duplicate
 * interest charges, etc.
 */

const AMEX_VALID_CARDHOLDERS = new Set([
  'EDWARD MAIONE JR',
  'DUMP ONE',
  'FERT ONE',
  'BOX TWO',
  'JACOB PELOQUIN',
  'EDWARD MAIONE JR BI',
])

interface ExtractedTxn {
  date: string
  description: string
  amount: number
  card?: string | null
  type?: string
  [key: string]: unknown
}

interface SanitizationResult {
  transactions: ExtractedTxn[]
  removed: Array<{ txn: ExtractedTxn; reason: string }>
  fixed: Array<{ txn: ExtractedTxn; field: string; from: unknown; to: unknown }>
}

export function sanitizeExtractedTransactions(
  transactions: ExtractedTxn[],
  options: {
    closingDate?: string // YYYY-MM-DD
    isAmex?: boolean
    validCardholders?: Set<string>
  } = {}
): SanitizationResult {
  const removed: SanitizationResult['removed'] = []
  const fixed: SanitizationResult['fixed'] = []
  const cardholders = options.validCardholders || (options.isAmex ? AMEX_VALID_CARDHOLDERS : null)

  let cleaned = [...transactions]

  // 1. Remove transactions with invalid cardholders
  if (cardholders) {
    cleaned = cleaned.filter((txn) => {
      if (!txn.card) return true // null card is OK for payments/interest
      // Normalize for comparison
      const normalized = txn.card.trim().toUpperCase()
      if (cardholders.has(normalized)) return true

      // Try fuzzy match (handle OCR errors like "JACOPELOQUIN" → "JACOB PELOQUIN")
      for (const valid of cardholders) {
        if (normalized.replace(/\s+/g, '').includes(valid.replace(/\s+/g, '')) ||
            valid.replace(/\s+/g, '').includes(normalized.replace(/\s+/g, ''))) {
          // Fix the card name
          fixed.push({ txn, field: 'card', from: txn.card, to: valid })
          txn.card = valid
          return true
        }
      }

      removed.push({ txn, reason: `Unknown cardholder: "${txn.card}"` })
      return false
    })
  }

  // 2. Fix wrong-year dates
  if (options.closingDate) {
    const closingYear = parseInt(options.closingDate.substring(0, 4))
    const closingMonth = parseInt(options.closingDate.substring(5, 7))
    // Statement transactions can be in closingYear or closingYear-1 if closing is in Jan
    const validYears = new Set([closingYear])
    if (closingMonth <= 2) validYears.add(closingYear - 1)

    cleaned = cleaned.filter((txn) => {
      if (!txn.date) {
        removed.push({ txn, reason: 'Missing date' })
        return false
      }
      const txnYear = parseInt(txn.date.substring(0, 4))
      if (validYears.has(txnYear)) return true

      // Try to fix: if only the year is wrong, correct it
      if (txnYear !== closingYear && txn.date.length >= 10) {
        const correctedDate = `${closingYear}${txn.date.substring(4)}`
        fixed.push({ txn, field: 'date', from: txn.date, to: correctedDate })
        txn.date = correctedDate
        return true
      }

      removed.push({ txn, reason: `Wrong year: ${txn.date} (expected ${closingYear})` })
      return false
    })
  }

  // 3. Deduplicate interest charges — keep only one
  const interestTxns = cleaned.filter(
    (t) => t.type === 'interest' || (t.description || '').toLowerCase().includes('interest charge')
  )
  if (interestTxns.length > 1) {
    // Keep the one with the latest date, or the first one if dates match
    interestTxns.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    const kept = interestTxns[0]
    for (let i = 1; i < interestTxns.length; i++) {
      removed.push({ txn: interestTxns[i], reason: 'Duplicate interest charge' })
    }
    const dupeInterestSet = new Set(interestTxns.slice(1))
    cleaned = cleaned.filter((t) => !dupeInterestSet.has(t))
  }

  // 4. Remove transactions outside statement period (±5 day tolerance)
  if (options.closingDate) {
    const closingMs = new Date(options.closingDate).getTime()
    const periodStartMs = closingMs - 40 * 24 * 60 * 60 * 1000 // ~40 days before closing
    const periodEndMs = closingMs + 5 * 24 * 60 * 60 * 1000 // 5 day grace after closing

    cleaned = cleaned.filter((txn) => {
      const txnMs = new Date(txn.date).getTime()
      if (txnMs >= periodStartMs && txnMs <= periodEndMs) return true

      removed.push({
        txn,
        reason: `Date ${txn.date} outside statement period (closing: ${options.closingDate})`,
      })
      return false
    })
  }

  // 5. Deduplicate exact duplicates (same date + amount + description)
  const seen = new Set<string>()
  cleaned = cleaned.filter((txn) => {
    const key = `${txn.date}|${txn.amount}|${(txn.description || '').substring(0, 30).toLowerCase()}`
    if (seen.has(key)) {
      removed.push({ txn, reason: 'Exact duplicate' })
      return false
    }
    seen.add(key)
    return true
  })

  return { transactions: cleaned, removed, fixed }
}
