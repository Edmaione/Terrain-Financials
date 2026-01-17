import { normalizeHeaderValue } from '@/lib/import-header-fingerprint'
import { AmountStrategy, ImportFieldMapping } from '@/types'

export type MappingValidationResult = {
  isValid: boolean
  errors: string[]
}

type HeaderMatch = {
  normalized: string
  original: string
}

const FIELD_CANDIDATES: Record<keyof ImportFieldMapping, string[]> = {
  date: ['date', 'transaction_date', 'posting_date', 'posted_date', 'trans_date'],
  amount: ['amount', 'transaction_amount', 'amt', 'net_amount'],
  inflow: ['credit', 'inflow', 'deposit', 'paid_in', 'money_in'],
  outflow: ['debit', 'outflow', 'withdrawal', 'paid_out', 'money_out'],
  payee: ['payee', 'merchant', 'name', 'vendor', 'counterparty'],
  description: ['description', 'details', 'transaction_description'],
  memo: ['memo', 'notes', 'note'],
  reference: ['reference', 'ref', 'reference_number', 'check_number', 'check_or_slip', 'check_no'],
  category: ['category', 'type'],
  status: ['status', 'state'],
}

const EMPTY_MAPPING: ImportFieldMapping = {
  date: null,
  amount: null,
  inflow: null,
  outflow: null,
  payee: null,
  description: null,
  memo: null,
  reference: null,
  category: null,
  status: null,
}

function buildHeaderLookup(headers: string[]): HeaderMatch[] {
  return headers.map((header) => ({
    original: header,
    normalized: normalizeHeaderValue(header),
  }))
}

function pickHeader(headers: HeaderMatch[], candidates: string[]) {
  for (const candidate of candidates) {
    const match = headers.find(
      (header) =>
        header.normalized === candidate ||
        header.normalized.startsWith(`${candidate}_`) ||
        header.normalized.includes(candidate)
    )
    if (match) {
      return match.original
    }
  }
  return null
}

export function detectMappingFromHeaders(headers: string[]) {
  const lookup = buildHeaderLookup(headers)
  const mapping: ImportFieldMapping = { ...EMPTY_MAPPING }

  mapping.date = pickHeader(lookup, FIELD_CANDIDATES.date)
  mapping.amount = pickHeader(lookup, FIELD_CANDIDATES.amount)
  mapping.inflow = pickHeader(lookup, FIELD_CANDIDATES.inflow)
  mapping.outflow = pickHeader(lookup, FIELD_CANDIDATES.outflow)
  mapping.payee = pickHeader(lookup, FIELD_CANDIDATES.payee)
  mapping.description = pickHeader(lookup, FIELD_CANDIDATES.description)
  mapping.memo = pickHeader(lookup, FIELD_CANDIDATES.memo)
  mapping.reference = pickHeader(lookup, FIELD_CANDIDATES.reference)
  mapping.category = pickHeader(lookup, FIELD_CANDIDATES.category)
  mapping.status = pickHeader(lookup, FIELD_CANDIDATES.status)

  const amountStrategy: AmountStrategy =
    mapping.inflow && mapping.outflow && !mapping.amount ? 'inflow_outflow' : 'signed'

  return { mapping, amountStrategy }
}

export function validateMapping({
  mapping,
  amountStrategy,
}: {
  mapping: ImportFieldMapping
  amountStrategy: AmountStrategy
}): MappingValidationResult {
  const errors: string[] = []

  if (!mapping.date) {
    errors.push('Map a date column to continue.')
  }

  if (amountStrategy === 'signed') {
    if (!mapping.amount) {
      errors.push('Map a signed amount column or switch to inflow/outflow.')
    }
  } else {
    if (!mapping.inflow || !mapping.outflow) {
      errors.push('Map both inflow and outflow columns to continue.')
    }
  }

  return { isValid: errors.length === 0, errors }
}

export function buildMappingPayload(mapping: ImportFieldMapping) {
  return {
    date: mapping.date ?? null,
    amount: mapping.amount ?? null,
    inflow: mapping.inflow ?? null,
    outflow: mapping.outflow ?? null,
    payee: mapping.payee ?? null,
    description: mapping.description ?? null,
    memo: mapping.memo ?? null,
    reference: mapping.reference ?? null,
    category: mapping.category ?? null,
    status: mapping.status ?? null,
  }
}
