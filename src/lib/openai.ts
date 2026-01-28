import OpenAI from 'openai';

const DEBUG_AI = process.env.DEBUG_AI === 'true';

let cachedClient: OpenAI | null | undefined;

function getOpenAIClient() {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[openai] OPENAI_API_KEY is not set - AI categorization disabled');
    cachedClient = null;
    return null;
  }

  if (DEBUG_AI) console.log('[openai] OpenAI client initialized successfully');
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

/**
 * Extract structured data from a PDF using GPT-4 Vision
 */
export async function extractPDFData(base64PDF: string, extractionType: 'receipt' | 'statement' | 'invoice') {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('[openai] OPENAI_API_KEY missing. Skipping PDF extraction.');
    return null;
  }

  const prompts = {
    receipt: `Extract the following information from this receipt:
- Vendor/Store name
- Date
- Total amount
- Tax amount (if present)
- Items purchased (if itemized)
- Payment method

Return as JSON with keys: vendor, date, total, tax, items (array), payment_method`,
    
    statement: `Extract all transactions from this bank/credit card statement.
For each transaction, extract:
- Date
- Description/Payee
- Amount (exactly as printed on the statement, do NOT flip signs)
- Category (if shown)

Return as JSON with key "transactions" containing an array of transaction objects.`,
    
    invoice: `Extract the following from this invoice:
- Vendor name
- Invoice number
- Invoice date
- Due date
- Line items with descriptions and amounts
- Subtotal
- Tax
- Total

Return as JSON.`
  };

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompts[extractionType],
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:application/pdf;base64,${base64PDF}`,
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  });

  const result = response.choices[0].message.content;
  if (!result) return null;

  try {
    return JSON.parse(result);
  } catch {
    console.error('[openai] Failed to parse PDF extraction response as JSON');
    return null;
  }
}

// Generic statement extraction prompt (for non-Amex statements)
const GENERIC_STATEMENT_PROMPT = `Return JSON with this exact schema:
{
  "account_type": "checking" | "savings" | "credit_card" | "loan",
  "account_number_last4": "1234" or null,
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "beginning_balance": 1234.56,
  "ending_balance": 2345.67,
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "Payee or description text", "amount": 123.45 }
  ]
}

RULES:
1. Report amounts EXACTLY as printed on the statement. Do NOT flip or negate any signs.
   If a charge shows as $306.48, output 306.48. If a payment shows as -$4,562.07, output -4562.07.
2. beginning_balance and ending_balance: Use the EXACT numbers shown on the statement.
   For credit cards these are positive numbers representing amount owed (e.g. "New Balance: $5,432.10" → 5432.10).
   beginning_balance = "Previous Balance" or "Opening Balance" on the statement.
   ending_balance = "New Balance" or "Closing Balance" or "Statement Balance".
3. Business credit card statements (e.g. Amex Business) often have MULTIPLE cards/cardholders
   that roll up to one account. Include transactions from ALL cards. The balances should be
   for the overall account total (the summary at the top), NOT individual card subtotals.
4. Extract ALL transactions listed. Use exact dates. For descriptions, use the merchant/payee name.
   Do NOT include summary lines, subtotals, or balance-forward entries as transactions.
5. If the statement shows "Total New Charges", "Payments/Credits", "Fees", "Interest Charged" as
   summary amounts, do NOT use those as transactions — only extract the individual line items.`;

// Amex Business Prime Card - highly specific prompt based on actual statement analysis
const AMEX_BUSINESS_PRIME_PROMPT = `You are extracting transaction data from an American Express Business Prime Card statement PDF.

## ANTI-HALLUCINATION RULES — READ FIRST

You MUST only extract data that is LITERALLY VISIBLE on the page images provided.
- Do NOT invent, guess, or fabricate any transaction that is not printed on the page.
- Do NOT fill in gaps with plausible-sounding merchants (no guessing "Starbucks", "Walmart", etc.).
- If text is blurry or unreadable, output the closest readable approximation — do NOT substitute a different merchant name.
- If you cannot read a transaction clearly, SKIP it rather than guess.
- Every transaction you output must correspond to a specific line you can point to on the page.

## VALID CARDHOLDERS — WHITELIST

Only these cardholder names appear on this account:
- EDWARD MAIONE JR
- DUMP ONE
- FERT ONE
- BOX TWO
- JACOB PELOQUIN
- EDWARD MAIONE JR BI

If you see a cardholder name not on this list, you are hallucinating. Do NOT output that transaction.

## STATEMENT STRUCTURE

### 1. PAYMENTS AND CREDITS (Usually Page 3)
Location: Under "Payments and Credits" header, in the "Detail" subsection (NOT the "Summary" subsection)
- Look for the word "Detail" with "*Indicates posting date" note
- Payments: "ONLINE PAYMENT - THANK YOU" or "AUTOPAY PAYMENT - THANK YOU"
- Credits: "AMAZON SHOP WITH POINTS CREDIT"
- Amounts are NEGATIVE on the statement (e.g., -$4,562.07)
- Format: MM/DD/YY* | CARDHOLDER NAME | DESCRIPTION | -$AMOUNT

### 2. NEW CHARGES BY CARDHOLDER (Transaction detail pages)
Location: Under "Detail" or "Detail Continued" headers
- Each card section starts with cardholder name, followed by "Card Ending X-XXXXX"
- Transaction format: MM/DD/YY | MERCHANT NAME [LOCATION INFO] | CITY | STATE | $AMOUNT
- Some transactions have a SECOND LINE with phone number, email, or category — this is NOT a separate transaction
- **PAGE CONTINUATIONS**: When a "Detail Continued" header appears on a new page, the transactions that follow STILL belong to the cardholder section that was active on the previous page, UNTIL a new cardholder header appears. Track the current cardholder across page boundaries.

### 3. INTEREST CHARGES (Usually near end, before notices)
Location: Under "Interest Charged" header in the DETAIL section
- Single line item: Date | "Interest Charge on Purchases" | $Amount
- Extract this ONCE only. The Account Summary on page 1 also shows interest — do NOT double-count.
- Do NOT extract from the "Interest Charge Calculation" table (the APR breakdown table).

## DO NOT EXTRACT — CRITICAL

1. **Summary tables** — rows with MULTIPLE dollar columns
2. **Subtotal rows** by cardholder — e.g. "EDWARD MAIONE JR 6-21002 $1,699.64 $0.00 $1,699.64"
3. **"Total" rows** — "Total Payments", "Total New Charges", etc.
4. **Section headers** — cardholder names alone, "Card Ending X-XXXXX", "Monthly Spending Limit"
5. **Interest Charge Calculation table** — the APR breakdown
6. **Account Summary box** from page 1
7. **New Charges Summary table** — per-cardholder totals with 3 amount columns
8. **Notices, rewards, legal pages** — pages 8+ typically have no transactions

## STATEMENT PERIOD

- period_end = "Statement Closing Date" from page 1
- period_start = approximately 30-35 days BEFORE period_end (the previous closing date)
  Look for "Previous Closing Date" on page 1, or calculate as ~31 days before period_end.
- All transaction dates should fall between period_start and period_end.
  If you extract a date from a different YEAR, you are reading it wrong.

## SIGN CONVENTION — REPORT AS PRINTED

Report amounts EXACTLY as they appear on the statement. Do NOT flip or negate any signs.

| Transaction Type | On Statement | In Output |
|-----------------|--------------|-----------|
| Payments | -$4,562.07 | -4562.07 |
| Credits/Refunds | -$139.92 | -139.92 |
| Purchases/Charges | $306.48 | 306.48 |
| Interest Charges | $138.02 | 138.02 |

## OUTPUT FORMAT

{
  "account_type": "credit_card",
  "account_number_last4": "XXXXX" (from "Account Ending" on page 1),
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD" (closing date),
  "beginning_balance": 21656.29 (Previous Balance — positive number as shown),
  "ending_balance": 21359.80 (Total Balance/New Balance — positive number as shown),
  "summary": {
    "payments_credits": 4701.99,
    "new_charges": 4267.48,
    "fees": 0.00,
    "interest": 138.02
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "MERCHANT NAME",
      "amount": 306.48,
      "card": "CARDHOLDER NAME",
      "type": "payment" | "credit" | "purchase" | "interest"
    }
  ]
}

## SELF-CHECK BEFORE RETURNING

1. Verify: beginning_balance + sum(transactions) ≈ ending_balance (within $1)
2. Verify: every "card" value is in the whitelist above
3. Verify: every date year matches the statement year (not 2023 for a 2025 statement)
4. Verify: interest appears exactly ONCE
5. Verify: transaction count is 50-80 for a typical monthly statement
6. If any check fails, re-read the pages and correct before returning.`;

/**
 * Detect statement type from first page image
 */
async function detectStatementType(openai: OpenAI, firstPageImage: string): Promise<'amex_business_prime' | 'amex_other' | 'generic'> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Look at this bank/credit card statement first page. Identify the statement type.

Return JSON: { "type": "amex_business_prime" | "amex_other" | "chase" | "bofa" | "generic", "confidence": 0.0-1.0 }

Indicators for amex_business_prime:
- "Business Prime Card" or "Amazon Business Prime" in header
- American Express business card with Amazon branding
- "Account Ending" format like "3-XXXXX"

Indicators for amex_other:
- American Express but NOT Business Prime (Blue Business, Gold, Platinum, etc.)

Otherwise return "generic".`
          },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${firstPageImage}` } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 100,
  });

  const result = response.choices[0].message.content;
  if (!result) return 'generic';

  try {
    const parsed = JSON.parse(result);
    if (DEBUG_AI) console.log(`[openai] Detected statement type: ${parsed.type} (confidence: ${parsed.confidence})`);
    if (parsed.type === 'amex_business_prime' && parsed.confidence > 0.7) return 'amex_business_prime';
    if (parsed.type?.startsWith('amex') && parsed.confidence > 0.7) return 'amex_other';
    return 'generic';
  } catch {
    return 'generic';
  }
}

export interface ExtractionAccountContext {
  accountType?: 'checking' | 'savings' | 'credit_card' | 'loan' | 'investment'
  institution?: string | null
}

/**
 * Extract structured statement data from a PDF.
 * Primary: Converts pages to images for GPT-4o vision (best for tables).
 * Fallback: Extracts text via pdf-parse if image conversion fails.
 *
 * When accountContext is provided, uses statement profiles instead of
 * LLM-based statement type detection.
 */
export async function extractStatementData(pdfBuffer: Buffer, accountContext?: ExtractionAccountContext) {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('[openai] OPENAI_API_KEY missing. Skipping statement extraction.');
    return null;
  }

  // Try image-based extraction first (best accuracy for tables)
  try {
    const result = await extractStatementViaImages(openai, pdfBuffer, accountContext);
    if (result) {
      // Validate extraction if we have balance data
      const validation = validateExtraction(result);
      if (validation.warnings.length > 0) {
        console.warn('[openai] Extraction validation warnings:', validation.warnings);
        result._validation = validation;
      }
      return result;
    }
  } catch (err) {
    console.warn('[openai] Image-based extraction failed, falling back to text:', err instanceof Error ? err.message : err);
  }

  // Fallback: text-based extraction
  try {
    return await extractStatementViaText(openai, pdfBuffer);
  } catch (err) {
    console.error('[openai] Text-based extraction also failed:', err);
    return null;
  }
}

/**
 * Validate extracted data for consistency
 */
function validateExtraction(data: Record<string, unknown>): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  const beginningBalance = data.beginning_balance as number | undefined;
  const endingBalance = data.ending_balance as number | undefined;
  const transactions = data.transactions as Array<{ amount: number }> | undefined;
  const summary = data.summary as { payments_credits?: number; new_charges?: number; fees?: number; interest?: number } | undefined;

  if (beginningBalance !== undefined && endingBalance !== undefined && transactions) {
    // Amounts are now as-printed on statement (no sign flipping by LLM).
    // For credit cards: charges are positive, payments/credits are negative.
    // Balance formula: beginning + charges - payments = ending
    // i.e., beginning + sum(transactions) ≈ ending
    const txnSum = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const expectedEnding = beginningBalance + txnSum;

    const tolerance = Math.abs(endingBalance) * 0.01 + 1;
    if (Math.abs(expectedEnding - endingBalance) > tolerance) {
      warnings.push(`Balance check: beginning (${beginningBalance.toFixed(2)}) + txn sum (${txnSum.toFixed(2)}) = ${expectedEnding.toFixed(2)}, expected ending ${endingBalance.toFixed(2)}`);
    }

    // If we have summary data, validate against it
    if (summary) {
      // Summary: new_charges + interest + fees are positive; payments_credits is positive but represents credits
      const summaryTotal = (summary.new_charges || 0) + (summary.interest || 0) + (summary.fees || 0) - (summary.payments_credits || 0);
      if (Math.abs(txnSum - summaryTotal) > tolerance) {
        warnings.push(`Transaction sum (${txnSum.toFixed(2)}) doesn't match summary breakdown (${summaryTotal.toFixed(2)})`);
      }
    }

    // Transaction count sanity check
    if (transactions.length < 5) {
      warnings.push(`Very few transactions extracted (${transactions.length}) - may be missing data`);
    }
  }

  return { valid: warnings.length === 0, warnings };
}

async function extractStatementViaImages(openai: OpenAI, pdfBuffer: Buffer, accountContext?: ExtractionAccountContext) {
  const { pdf } = await import('pdf-to-img');
  const pageImages: string[] = [];
  for await (const image of await pdf(pdfBuffer, { scale: 2 })) {
    pageImages.push(Buffer.from(image).toString('base64'));
  }

  if (pageImages.length === 0) return null;

  if (DEBUG_AI) console.log(`[openai] Converted PDF to ${pageImages.length} page images`);

  // Use profile-based detection if account context is available, otherwise fall back to LLM detection
  let useAmexPrompt = false;
  let useChunked = false;

  if (accountContext?.institution) {
    const { getStatementProfile, isAmexProfile } = await import('@/lib/extraction/statement-profiles');
    const profile = getStatementProfile(accountContext.institution, accountContext.accountType || 'checking', pageImages.length);
    useAmexPrompt = isAmexProfile(profile);
    useChunked = profile.strategy === 'chunked';
    if (DEBUG_AI) console.log(`[openai] Using profile: ${profile.key} (amex=${useAmexPrompt}, chunked=${useChunked})`);
  } else {
    // Legacy fallback: LLM-based detection
    const statementType = await detectStatementType(openai, pageImages[0]);
    useAmexPrompt = statementType === 'amex_business_prime';
    useChunked = useAmexPrompt && pageImages.length > 6;
  }

  if (useChunked) {
    return await extractAmexChunked(openai, pageImages);
  }

  const prompt = useAmexPrompt ? AMEX_BUSINESS_PRIME_PROMPT : GENERIC_STATEMENT_PROMPT;

  const imageContent: Array<{ type: 'image_url'; image_url: { url: string } }> = pageImages.map((b64) => ({
    type: 'image_url' as const,
    image_url: { url: `data:image/png;base64,${b64}` },
  }));

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `You are analyzing page images from a bank or credit card statement. Extract ALL data from ALL pages.\n\n${prompt}` },
          ...imageContent,
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 16000,
  });

  const result = response.choices[0].message.content;
  if (!result) return null;

  if (DEBUG_AI) console.log('[openai] Vision extraction result:', result.substring(0, 200));
  return JSON.parse(result);
}

/**
 * Chunked extraction for long Amex Business Prime statements.
 * Process in 3 phases:
 * 1. Page 1: Extract account info and balances
 * 2. Transaction pages (3-7ish): Extract in chunks of 2-3 pages
 * 3. Merge and deduplicate results
 */
async function extractAmexChunked(openai: OpenAI, pageImages: string[]) {
  if (DEBUG_AI) console.log(`[openai] Using chunked extraction for ${pageImages.length}-page Amex statement`);

  // Phase 1: Extract account info from page 1
  const metadataResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract ONLY the account metadata from this Amex Business Prime Card statement first page (Account Summary).

Return JSON:
{
  "account_type": "credit_card",
  "account_number_last4": "XXXXX",
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "beginning_balance": 12345.67,
  "ending_balance": 12345.67,
  "summary": {
    "payments_credits": 1234.56,
    "new_charges": 1234.56,
    "fees": 0.00,
    "interest": 123.45
  }
}

Get these from the "Account Summary" box:
- beginning_balance = "Previous Balance"
- ending_balance = "Total Balance" or "New Balance"
- payments_credits = "Payments/Credits" (as positive number)
- new_charges = "New Charges" (as positive number)
- fees = "Fees"
- interest = "Interest Charged"

Period dates from header: "Statement Closing Date" is period_end.`
          },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${pageImages[0]}` } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
  });

  let metadata: Record<string, unknown> = {};
  const metadataResult = metadataResponse.choices[0].message.content;
  if (metadataResult) {
    try {
      metadata = JSON.parse(metadataResult);
      if (DEBUG_AI) console.log('[openai] Extracted metadata:', JSON.stringify(metadata).substring(0, 200));
    } catch {
      console.warn('[openai] Failed to parse metadata');
    }
  }

  // Phase 2: Extract transactions in chunks (skip page 1-2 which are summary/legal)
  // Process pages 3+ in chunks of 3 pages
  const allTransactions: Array<Record<string, unknown>> = [];
  const transactionPages = pageImages.slice(2); // Skip first 2 pages
  const chunkSize = 3;

  for (let i = 0; i < transactionPages.length; i += chunkSize) {
    const chunk = transactionPages.slice(i, i + chunkSize);
    const pageNumbers = chunk.map((_, idx) => i + idx + 3); // Actual page numbers

    if (DEBUG_AI) console.log(`[openai] Processing pages ${pageNumbers.join(', ')}`);

    const imageContent = chunk.map((b64) => ({
      type: 'image_url' as const,
      image_url: { url: `data:image/png;base64,${b64}` },
    }));

    // Provide cardholder context from previous chunk
    const cardholderContext = i > 0 && allTransactions.length > 0
      ? `\nCONTEXT FROM PREVIOUS PAGES: The last cardholder section was "${(allTransactions[allTransactions.length - 1] as any).card || 'unknown'}". If these pages start with "Detail Continued" without a new cardholder header, transactions belong to that cardholder.\n`
      : '';

    const txnResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract ONLY transactions from these Amex Business Prime Card statement pages.
${cardholderContext}
## ANTI-HALLUCINATION RULES
- Only extract transactions LITERALLY VISIBLE on these pages. Do NOT invent any.
- If text is blurry, output your best reading — do NOT substitute a different merchant.
- If you cannot read a transaction, SKIP it.

## VALID CARDHOLDERS (whitelist — reject any other name)
EDWARD MAIONE JR, DUMP ONE, FERT ONE, BOX TWO, JACOB PELOQUIN, EDWARD MAIONE JR BI

## EXTRACT FROM:
- "Payments and Credits" Detail section (NOT Summary)
- "New Charges" Detail / "Detail Continued" sections for each cardholder
- "Interest Charged" single line item (extract ONCE only)

## DO NOT EXTRACT:
- Summary tables (multiple $ columns)
- Subtotal rows (like "EDWARD MAIONE JR 6-21002 $X,XXX.XX $0.00 $X,XXX.XX")
- "Total" rows, section headers, Interest Charge Calculation table
- Notices, rewards, legal text

## PAGE CONTINUATIONS
When "Detail Continued" appears without a new cardholder header, transactions belong to the LAST cardholder section from the previous page.

## SIGN CONVENTION — REPORT AS PRINTED:
Payments shown as -$4,562.07 → output -4562.07
Credits shown as -$139.92 → output -139.92
Charges shown as $306.48 → output 306.48
Interest shown as $138.02 → output 138.02

## DATE VALIDATION
All dates must be from the statement year. If you read a date from a different year, re-read it.

Return JSON:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "MERCHANT NAME",
      "amount": -123.45,
      "card": "CARDHOLDER NAME",
      "type": "payment" | "credit" | "purchase" | "interest"
    }
  ],
  "page_info": "pages ${pageNumbers.join(', ')}"
}`
            },
            ...imageContent,
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
    });

    const txnResult = txnResponse.choices[0].message.content;
    if (txnResult) {
      try {
        const parsed = JSON.parse(txnResult);
        if (parsed.transactions && Array.isArray(parsed.transactions)) {
          allTransactions.push(...parsed.transactions);
          if (DEBUG_AI) console.log(`[openai] Extracted ${parsed.transactions.length} transactions from pages ${pageNumbers.join(', ')}`);
        }
      } catch {
        console.warn(`[openai] Failed to parse transactions from pages ${pageNumbers.join(', ')}`);
      }
    }
  }

  // Phase 3: Deduplicate and merge
  const seen = new Set<string>();
  const uniqueTransactions = allTransactions.filter((txn) => {
    const key = `${txn.date}|${txn.description}|${txn.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (DEBUG_AI) {
    console.log(`[openai] Total transactions: ${allTransactions.length}, after dedup: ${uniqueTransactions.length}`);
  }

  return {
    ...metadata,
    transactions: uniqueTransactions,
    _extraction_method: 'chunked',
    _pages_processed: pageImages.length,
  };
}

async function extractStatementViaText(openai: OpenAI, pdfBuffer: Buffer) {
  const pdfParse = (await import('pdf-parse')).default;
  const parsed = await pdfParse(pdfBuffer);
  const pdfText = parsed.text;

  if (!pdfText || pdfText.trim().length === 0) {
    console.error('[openai] No text extracted from PDF');
    return null;
  }

  if (DEBUG_AI) console.log(`[openai] Extracted ${pdfText.length} chars from PDF (${parsed.numpages} pages)`);

  // Detect if this is an Amex statement from text
  const isAmexPrime = pdfText.includes('Business Prime Card') || pdfText.includes('Amazon Business Prime');
  const prompt = isAmexPrime ? AMEX_BUSINESS_PRIME_PROMPT : GENERIC_STATEMENT_PROMPT;

  const text = pdfText.length > 50000 ? pdfText.substring(0, 50000) : pdfText;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `You are analyzing the extracted text from a bank or credit card statement. The text was extracted programmatically so formatting may be lost — use your best judgment to identify fields, balances, and transactions.\n\nSTATEMENT TEXT:\n${text}\n\n---\n\n${prompt}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 16000,
  });

  const result = response.choices[0].message.content;
  if (!result) return null;

  if (DEBUG_AI) console.log('[openai] Text extraction result:', result.substring(0, 200));
  return JSON.parse(result);
}

/**
 * Suggest a category for a transaction using GPT
 */
export async function suggestCategory(
  payee: string,
  description: string | undefined,
  amount: number,
  availableCategories: Array<{ id: string; name: string; section: string }>,
  historicalTransactions?: Array<{ payee: string; category: string }>
) {
  if (DEBUG_AI) console.log('[openai] suggestCategory called for:', payee.substring(0, 30));

  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('[openai] OPENAI_API_KEY missing. Skipping category suggestion.');
    return null;
  }

  const categoryList = availableCategories
    .map(c => `- ${c.name} (${c.section})`)
    .join('\n');

  // Use up to 20 historical patterns for better context
  const historyContext = historicalTransactions?.length
    ? `\n\nHistorical categorization patterns (most recent first):\n${historicalTransactions
        .slice(0, 20)
        .map(t => `• "${t.payee}" → ${t.category}`)
        .join('\n')}`
    : '';

  // Determine amount hints
  const absAmount = Math.abs(amount);
  let amountHint = '';
  if (absAmount < 50 && amount < 0) {
    amountHint = 'Small recurring expense - could be subscription, supplies, or minor purchase.';
  } else if (absAmount >= 500 && absAmount < 5000 && amount < 0) {
    amountHint = 'Medium expense - could be equipment rental, materials, or professional services.';
  } else if (absAmount >= 5000 && amount < 0) {
    amountHint = 'Large expense - likely equipment purchase, vehicle expense, or significant contractor payment.';
  } else if (amount > 0) {
    amountHint = 'Income transaction - likely customer payment, refund, or deposit.';
  }

  const prompt = `You are categorizing a transaction for a landscaping company (S-corp).

LANDSCAPING BUSINESS CONTEXT:
Common expense patterns for landscaping businesses:
• Fuel (Shell, Exxon, Chevron, BP) → Fuel or Vehicle Expenses
• Equipment stores (Home Depot, Lowe's, SiteOne, John Deere) → Supplies, Equipment, or Materials
• Plant nurseries → Materials or Landscaping Materials
• Rental centers → Equipment Rental
• Insurance payments → Insurance
• Phone/cellular (T-Mobile, Verizon, AT&T) → Cell Phone / Utilities
• Software subscriptions (Adobe, Microsoft, QuickBooks) → Software Subscriptions
• Restaurants/food while working → Meals & Entertainment (50% deductible)
• Vehicle maintenance, repairs, parts → Vehicle Maintenance
• Contractor payments (Gusto, payroll) → Contract Labor or Payroll
• Bank fees, merchant fees → Bank Service Charges
• Amazon purchases → Supplies or Office Supplies (context dependent)
• Uniforms, safety gear → Uniforms & Safety

Transaction details:
- Payee: ${payee}
- Description: ${description || 'N/A'}
- Amount: $${Math.abs(amount).toFixed(2)} (${amount >= 0 ? 'income/credit' : 'expense/debit'})
- ${amountHint}

Available categories:
${categoryList}
${historyContext}

Based on the payee name, description, amount, and any historical patterns, select the most appropriate category.

Return JSON with:
{
  "category_name": "exact category name from the available list",
  "confidence": 0.0 to 1.0 (be conservative - only 0.9+ if very certain),
  "reasoning": "brief explanation"
}`;

  if (DEBUG_AI) console.log('[openai] Calling GPT-4o-mini...');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial categorization assistant for a landscaping business. Prioritize accuracy over speed. When uncertain, use a lower confidence score. Always return valid JSON matching the exact category names provided.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2, // Lower temperature for more consistent results
      max_tokens: 250,
    });

    const result = response.choices[0].message.content;
    if (DEBUG_AI) console.log('[openai] Response received:', result?.substring(0, 100));
    return result ? JSON.parse(result) : null;
  } catch (error) {
    console.error('[openai] API call failed:', error);
    return null;
  }
}

/**
 * Batch categorize multiple transactions
 */
export async function batchSuggestCategories(
  transactions: Array<{
    id: string;
    payee: string;
    description?: string;
    amount: number;
  }>,
  availableCategories: Array<{ id: string; name: string; section: string }>
) {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('[openai] OPENAI_API_KEY missing. Skipping batch suggestions.');
    return [];
  }
  // Process in batches of 10 to avoid token limits
  const batchSize = 10;
  const results = [];

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    
    const categoryList = availableCategories
      .map(c => `${c.id}: ${c.name} (${c.section})`)
      .join('\n');

    const transactionList = batch
      .map(t => `ID: ${t.id}, Payee: ${t.payee}, Description: ${t.description || 'N/A'}, Amount: $${Math.abs(t.amount).toFixed(2)}`)
      .join('\n');

    const prompt = `Categorize these transactions for a landscaping business (S-corp).

Available categories (ID: Name):
${categoryList}

Transactions:
${transactionList}

Return JSON array with objects containing:
{
  "id": "transaction id",
  "category_id": "category uuid",
  "confidence": 0.0 to 1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = response.choices[0].message.content;
    if (result) {
      try {
        const parsed = JSON.parse(result);
        results.push(...(parsed.categorizations || []));
      } catch {
        console.error('[openai] Failed to parse batch categorization response as JSON');
      }
    }
  }

  return results;
}
