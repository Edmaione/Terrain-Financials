import Anthropic from '@anthropic-ai/sdk'
import { ExtractionProvider, RawStatementExtraction } from './provider'
import { StatementProfile, isAmexProfile } from './statement-profiles'

const DEBUG_AI = process.env.DEBUG_AI === 'true'

let cachedClient: Anthropic | null | undefined

function getAnthropicClient(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[anthropic] ANTHROPIC_API_KEY is not set - Anthropic extraction disabled')
    cachedClient = null
    return null
  }

  if (DEBUG_AI) console.log('[anthropic] Client initialized')
  cachedClient = new Anthropic({ apiKey })
  return cachedClient
}

// Extraction schema for Claude tool use
const EXTRACTION_TOOL = {
  name: 'save_statement_data',
  description: 'Save the extracted statement data in structured format',
  input_schema: {
    type: 'object' as const,
    properties: {
      account_type: {
        type: 'string',
        enum: ['checking', 'savings', 'credit_card', 'loan'],
      },
      account_number_last4: { type: ['string', 'null'] },
      period_start: { type: 'string', description: 'YYYY-MM-DD' },
      period_end: { type: 'string', description: 'YYYY-MM-DD' },
      beginning_balance: { type: 'number' },
      ending_balance: { type: 'number' },
      summary: {
        type: 'object',
        properties: {
          payments_credits: { type: 'number' },
          new_charges: { type: 'number' },
          fees: { type: 'number' },
          interest: { type: 'number' },
        },
      },
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD' },
            description: { type: 'string' },
            amount: { type: 'number', description: 'Amount exactly as printed on statement' },
            card: { type: ['string', 'null'] },
            type: { type: 'string', enum: ['payment', 'credit', 'purchase', 'interest'] },
          },
          required: ['date', 'description', 'amount'],
        },
      },
    },
    required: ['account_type', 'period_start', 'period_end', 'beginning_balance', 'ending_balance', 'transactions'],
  },
}

function buildPrompt(profile: StatementProfile): string {
  const base = `Extract ALL transaction data from this bank/credit card statement.

## ANTI-HALLUCINATION RULES — READ FIRST
- ONLY extract data LITERALLY VISIBLE on the page images.
- Do NOT invent, guess, or fabricate any transaction.
- If text is blurry, output your best reading — do NOT substitute a different merchant.
- If you cannot read a transaction, SKIP it.

CRITICAL: Report amounts EXACTLY as printed on the statement. Do NOT flip or negate any signs.

Rules:
- Extract every individual transaction. Do NOT extract summary lines, subtotals, or totals.
- Use YYYY-MM-DD format for dates.
- For descriptions, use the merchant/payee name.
- beginning_balance and ending_balance: exact numbers from the statement.
- period_end = closing date. period_start = ~30-35 days before closing date.`

  if (isAmexProfile(profile)) {
    return `${base}

This is an American Express Business Prime Card statement. Specific rules:
- Extract from "Payments and Credits" Detail section, "New Charges" Detail sections, and "Interest Charged" detail.
- Do NOT extract Summary tables, subtotal rows by cardholder, "Total" rows, section headers, or the Interest Charge Calculation table.
- Payments/credits are shown as negative on the statement (e.g., -$4,562.07) — report as-is.
- Charges/interest are shown as positive (e.g., $306.48) — report as-is.
- Include the cardholder name in the "card" field.
- Include transaction type: "payment", "credit", "purchase", or "interest".
- Interest: extract ONCE from the Detail section only. Do NOT also extract from the Account Summary.

## VALID CARDHOLDERS (whitelist)
Only output transactions with these cardholder names:
EDWARD MAIONE JR, DUMP ONE, FERT ONE, BOX TWO, JACOB PELOQUIN, EDWARD MAIONE JR BI
Any other cardholder name means you are misreading the page.

## PAGE CONTINUATIONS
When "Detail Continued" appears on a new page without a new cardholder header, the transactions belong to the cardholder that was active on the previous page.

## DATE VALIDATION
All dates must be from the statement year. If you read a date from a different year, re-read it.`
  }

  return base
}

export class AnthropicExtractionProvider implements ExtractionProvider {
  name = 'anthropic'

  async extractStatement(
    pageImages: string[],
    profile: StatementProfile
  ): Promise<RawStatementExtraction | null> {
    const client = getAnthropicClient()
    if (!client) return null

    const prompt = buildPrompt(profile)

    // Build image content blocks
    const imageBlocks: Anthropic.Messages.ImageBlockParam[] = pageImages.map((b64) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: b64,
      },
    }))

    if (DEBUG_AI) console.log(`[anthropic] Extracting from ${pageImages.length} pages`)

    try {
      // Try single-pass first (Claude's 200K context handles long docs well)
      const result = await this.extractSinglePass(client, prompt, imageBlocks)
      if (result) {
        result._extraction_method = 'anthropic_single_pass'
        result._pages_processed = pageImages.length
        return result
      }
    } catch (err) {
      console.warn('[anthropic] Single-pass extraction failed:', err instanceof Error ? err.message : err)

      // Fall back to chunked if single-pass fails
      if (profile.strategy === 'chunked' && pageImages.length > 6) {
        try {
          const result = await this.extractChunked(client, prompt, pageImages, profile)
          if (result) {
            result._extraction_method = 'anthropic_chunked'
            result._pages_processed = pageImages.length
            return result
          }
        } catch (chunkErr) {
          console.error('[anthropic] Chunked extraction also failed:', chunkErr)
        }
      }
    }

    return null
  }

  private async extractSinglePass(
    client: Anthropic,
    prompt: string,
    imageBlocks: Anthropic.Messages.ImageBlockParam[]
  ): Promise<RawStatementExtraction | null> {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'save_statement_data' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageBlocks,
          ],
        },
      ],
    })

    // Extract tool use result
    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'save_statement_data') {
        if (DEBUG_AI) {
          const data = block.input as RawStatementExtraction
          console.log(`[anthropic] Extracted ${data.transactions?.length || 0} transactions`)
        }
        return block.input as RawStatementExtraction
      }
    }

    return null
  }

  private async extractChunked(
    client: Anthropic,
    prompt: string,
    pageImages: string[],
    profile: StatementProfile
  ): Promise<RawStatementExtraction | null> {
    // Extract metadata from first page
    const metadataResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'save_statement_data' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract ONLY the account metadata from this statement first page (balances, dates, account info). Set transactions to an empty array.',
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: pageImages[0] },
            },
          ],
        },
      ],
    })

    let metadata: Partial<RawStatementExtraction> = {}
    for (const block of metadataResponse.content) {
      if (block.type === 'tool_use' && block.name === 'save_statement_data') {
        metadata = block.input as RawStatementExtraction
        break
      }
    }

    // Extract transactions in chunks
    const skipSet = new Set(profile.skipPages)
    const txnPages = pageImages.filter((_, i) => !skipSet.has(i))
    const chunkSize = profile.chunkSize || 3
    const allTransactions: RawStatementExtraction['transactions'] = []

    for (let i = 0; i < txnPages.length; i += chunkSize) {
      const chunk = txnPages.slice(i, i + chunkSize)
      const chunkBlocks: Anthropic.Messages.ImageBlockParam[] = chunk.map((b64) => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: b64 },
      }))

      if (DEBUG_AI) console.log(`[anthropic] Processing chunk ${Math.floor(i / chunkSize) + 1}`)

      const chunkResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'save_statement_data' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${prompt}\n\nExtract ONLY transactions from these pages. Use the same account metadata for all chunks.` },
              ...chunkBlocks,
            ],
          },
        ],
      })

      for (const block of chunkResponse.content) {
        if (block.type === 'tool_use' && block.name === 'save_statement_data') {
          const data = block.input as RawStatementExtraction
          if (data.transactions) {
            allTransactions.push(...data.transactions)
          }
          break
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>()
    const uniqueTransactions = allTransactions.filter((txn) => {
      const key = `${txn.date}|${txn.description}|${txn.amount}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (DEBUG_AI) {
      console.log(`[anthropic] Total: ${allTransactions.length}, deduped: ${uniqueTransactions.length}`)
    }

    return {
      account_type: metadata.account_type || 'credit_card',
      account_number_last4: metadata.account_number_last4 || null,
      period_start: metadata.period_start || '',
      period_end: metadata.period_end || '',
      beginning_balance: metadata.beginning_balance || 0,
      ending_balance: metadata.ending_balance || 0,
      summary: metadata.summary,
      transactions: uniqueTransactions,
    }
  }
}

/**
 * Check if Anthropic extraction is available and configured.
 */
export function isAnthropicAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.EXTRACTION_PROVIDER === 'anthropic'
}
