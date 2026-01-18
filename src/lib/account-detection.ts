import { parseCSVText } from '@/lib/csv-parser'

export type AccountCandidate = {
  id: string
  name: string
  institution?: string | null
  account_number?: string | null
  last4?: string | null
}

export type AccountImportMapping = {
  id: string
  account_id: string
  institution?: string | null
  statement_account_name?: string | null
  account_number?: string | null
  account_last4?: string | null
  header_signature?: string | null
  confidence?: number | null
}

export type AccountDetectionResult = {
  suggestedAccountId: string | null
  confidence: number
  reason: string
  method: 'mapping_table' | 'header_match' | 'column_match' | 'manual' | 'unknown'
  detected: {
    institution?: string
    accountLast4?: string
    accountNumber?: string
    statementAccountName?: string
    headerSignature?: string | null
  }
}

const MAX_HEADER_LINES = 30
const MAX_SAMPLE_ROWS = 50

const CONFIDENCE = {
  mapping: 0.95,
  accountNumber: 0.9,
  last4: 0.78,
  institutionOnly: 0.45,
  none: 0.2,
}

type CandidateMatch = {
  accountId: string
  reason: string
  confidence: number
  method: AccountDetectionResult['method']
}

function normalizeDigits(value?: string | null) {
  return value ? value.replace(/\D/g, '') : ''
}

function normalizeText(value?: string | null) {
  return value?.trim() || ''
}

function extractHeaderContext(csvText: string) {
  return csvText.split(/\r?\n/).slice(0, MAX_HEADER_LINES).join('\n')
}

function extractStatementAccountName(headerContext: string) {
  const match = headerContext.match(/account\s+name[:\s]+([^\n\r]+)/i)
  return match?.[1]?.trim() || undefined
}

function extractAccountIdentifiers(text: string) {
  const candidates: string[] = []
  const patterns = [
    /ending\s+in\s+(\d{3,10})/gi,
    /account\s*(?:number)?\s*[*xX#-]*\s*(\d{3,12})/gi,
    /card\s*(?:number)?\s*[*xX#-]*\s*(\d{3,12})/gi,
    /acct\s*(?:number)?\s*[*xX#-]*\s*(\d{3,12})/gi,
    /last\s*4\s*[:#-]?\s*(\d{4,6})/gi,
  ]

  for (const pattern of patterns) {
    let match = pattern.exec(text)
    while (match) {
      candidates.push(match[1])
      match = pattern.exec(text)
    }
  }

  const cleaned = candidates.map((value) => normalizeDigits(value)).filter(Boolean)
  const unique = Array.from(new Set(cleaned))
  return unique
}

function extractColumnIdentifiers(headers: string[], rows: Array<Record<string, string>>) {
  const normalizedHeaders = headers.map((header) => header.trim())
  const columnKeys = normalizedHeaders.filter((header) =>
    /account|acct|card|last\s*4|ending/i.test(header)
  )

  const candidates: string[] = []

  for (const key of columnKeys) {
    for (const row of rows.slice(0, MAX_SAMPLE_ROWS)) {
      const value = row[key]
      if (!value) continue
      const digits = normalizeDigits(value)
      if (digits.length >= 3) {
        candidates.push(digits)
        break
      }
    }
  }

  return Array.from(new Set(candidates))
}

function matchInstitution(headerContext: string, accounts: AccountCandidate[]) {
  const context = headerContext.toLowerCase()
  const institutions = Array.from(
    new Set(
      accounts
        .map((account) => normalizeText(account.institution).toLowerCase())
        .filter(Boolean)
    )
  )

  const matches = institutions.filter((institution) => context.includes(institution))
  return matches.length > 0 ? matches[0] : undefined
}

function coalesceValue(value?: string | null) {
  return value?.trim() || ''
}

function findMappingMatch(
  mappings: AccountImportMapping[],
  signature: {
    institution?: string
    statementAccountName?: string
    accountNumber?: string
    accountLast4?: string
    headerSignature?: string | null
  }
) {
  const signatureKey = {
    institution: coalesceValue(signature.institution),
    statement_account_name: coalesceValue(signature.statementAccountName),
    account_number: coalesceValue(signature.accountNumber),
    account_last4: coalesceValue(signature.accountLast4),
    header_signature: coalesceValue(signature.headerSignature || undefined),
  }

  const matches = mappings.filter((mapping) => {
    return (
      coalesceValue(mapping.institution) === signatureKey.institution &&
      coalesceValue(mapping.statement_account_name) === signatureKey.statement_account_name &&
      coalesceValue(mapping.account_number) === signatureKey.account_number &&
      coalesceValue(mapping.account_last4) === signatureKey.account_last4 &&
      coalesceValue(mapping.header_signature) === signatureKey.header_signature
    )
  })

  if (matches.length === 1) {
    return matches[0]
  }
  return null
}

function rankMatches(
  matches: AccountCandidate[],
  institution?: string
): AccountCandidate[] {
  if (!institution) return matches
  const narrowed = matches.filter(
    (account) => normalizeText(account.institution).toLowerCase() === institution.toLowerCase()
  )
  return narrowed.length > 0 ? narrowed : matches
}

export function detectAccountFromCsv({
  csvText,
  accounts,
  mappings = [],
  headerSignature,
}: {
  csvText: string
  accounts: AccountCandidate[]
  mappings?: AccountImportMapping[]
  headerSignature?: string | null
}): AccountDetectionResult {
  const headerContext = extractHeaderContext(csvText)
  const parsed = parseCSVText(csvText)
  const detectedInstitution = matchInstitution(headerContext, accounts)
  const headerIdentifiers = extractAccountIdentifiers(headerContext)
  const columnIdentifiers = extractColumnIdentifiers(parsed.headers, parsed.rows)
  const statementAccountName = extractStatementAccountName(headerContext)

  const accountNumberCandidate = headerIdentifiers.find((value) => value.length >= 6)
  const accountLast4Candidate =
    headerIdentifiers.find((value) => value.length >= 3 && value.length <= 6) ||
    columnIdentifiers.find((value) => value.length >= 3 && value.length <= 6)

  const detected = {
    institution: detectedInstitution,
    accountLast4: accountLast4Candidate,
    accountNumber: accountNumberCandidate,
    statementAccountName,
    headerSignature: headerSignature ?? null,
  }

  const mappingMatch = findMappingMatch(mappings, detected)
  if (mappingMatch) {
    return {
      suggestedAccountId: mappingMatch.account_id,
      confidence: CONFIDENCE.mapping,
      reason: 'Matched a previously learned statement pattern.',
      method: 'mapping_table',
      detected,
    }
  }

  const normalizedAccountNumber = normalizeDigits(accountNumberCandidate)
  if (normalizedAccountNumber) {
    const matches = accounts.filter(
      (account) => normalizeDigits(account.account_number) === normalizedAccountNumber
    )
    const ranked = rankMatches(matches, detectedInstitution)
    if (ranked.length === 1) {
      return {
        suggestedAccountId: ranked[0].id,
        confidence: CONFIDENCE.accountNumber,
        reason: `Matched account number ${normalizedAccountNumber}.`,
        method: 'header_match',
        detected,
      }
    }
    if (ranked.length > 1) {
      return {
        suggestedAccountId: null,
        confidence: CONFIDENCE.none,
        reason: `Multiple accounts matched account number ${normalizedAccountNumber}.`,
        method: 'header_match',
        detected,
      }
    }
  }

  const normalizedLast4 = normalizeDigits(accountLast4Candidate)
  if (normalizedLast4) {
    const matches = accounts.filter((account) => {
      const accountLast4 = normalizeDigits(account.last4)
      const accountNumber = normalizeDigits(account.account_number)
      return accountLast4 === normalizedLast4 || accountNumber.endsWith(normalizedLast4)
    })
    const ranked = rankMatches(matches, detectedInstitution)
    if (ranked.length === 1) {
      return {
        suggestedAccountId: ranked[0].id,
        confidence: CONFIDENCE.last4,
        reason: `Matched statement ending in ${normalizedLast4}.`,
        method: columnIdentifiers.length > 0 ? 'column_match' : 'header_match',
        detected,
      }
    }
    if (ranked.length > 1) {
      return {
        suggestedAccountId: null,
        confidence: CONFIDENCE.none,
        reason: `Multiple accounts matched ending in ${normalizedLast4}.`,
        method: 'header_match',
        detected,
      }
    }
  }

  if (detectedInstitution) {
    const matches = accounts.filter(
      (account) => normalizeText(account.institution).toLowerCase() === detectedInstitution.toLowerCase()
    )
    if (matches.length === 1) {
      return {
        suggestedAccountId: matches[0].id,
        confidence: CONFIDENCE.institutionOnly,
        reason: `Matched institution ${detectedInstitution}.`,
        method: 'header_match',
        detected,
      }
    }
  }

  return {
    suggestedAccountId: null,
    confidence: CONFIDENCE.none,
    reason: 'No reliable account identifiers detected in the statement.',
    method: 'unknown',
    detected,
  }
}
