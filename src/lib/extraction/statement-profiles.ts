import { AccountType } from '@/types'

export interface StatementProfile {
  key: string
  accountType: AccountType
  strategy: 'single_pass' | 'chunked'
  chunkSize: number
  skipPages: number[]  // page indices to skip (0-indexed)
  promptKey: 'amex_business_prime' | 'generic'
}

/**
 * Known institution → profile mappings.
 * The key format is "{institution}_{accountType}" normalized to lowercase + underscores.
 */
const PROFILES: Record<string, StatementProfile> = {
  amex_credit_card: {
    key: 'amex_credit_card',
    accountType: 'credit_card',
    strategy: 'chunked',
    chunkSize: 3,
    skipPages: [0, 1],  // summary + legal pages
    promptKey: 'amex_business_prime',
  },
  american_express_credit_card: {
    key: 'american_express_credit_card',
    accountType: 'credit_card',
    strategy: 'chunked',
    chunkSize: 3,
    skipPages: [0, 1],
    promptKey: 'amex_business_prime',
  },
  chase_checking: {
    key: 'chase_checking',
    accountType: 'checking',
    strategy: 'single_pass',
    chunkSize: 0,
    skipPages: [],
    promptKey: 'generic',
  },
  chase_credit_card: {
    key: 'chase_credit_card',
    accountType: 'credit_card',
    strategy: 'single_pass',
    chunkSize: 0,
    skipPages: [],
    promptKey: 'generic',
  },
}

/**
 * Build a profile key from institution + account type.
 */
function buildProfileKey(institution: string | null | undefined, accountType: AccountType): string {
  const inst = (institution || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `${inst}_${accountType}`
}

/**
 * Get the statement profile for an account.
 * Falls back to a sensible default profile based on account type.
 */
export function getStatementProfile(
  institution: string | null | undefined,
  accountType: AccountType,
  pageCount?: number
): StatementProfile {
  const key = buildProfileKey(institution, accountType)

  // Check for exact match
  if (PROFILES[key]) {
    return PROFILES[key]
  }

  // Default profile based on account type
  const isLong = (pageCount || 0) > 6
  return {
    key,
    accountType,
    strategy: isLong ? 'chunked' : 'single_pass',
    chunkSize: isLong ? 3 : 0,
    skipPages: [],
    promptKey: 'generic',
  }
}

/**
 * Check if a profile uses the Amex Business Prime prompt.
 */
export function isAmexProfile(profile: StatementProfile): boolean {
  return profile.promptKey === 'amex_business_prime'
}
