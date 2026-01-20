import OpenAI from 'openai';

let cachedClient: OpenAI | null | undefined;

function getOpenAIClient() {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    cachedClient = null;
    return null;
  }

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
- Amount (negative for debits, positive for credits)
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
  return result ? JSON.parse(result) : null;
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
  return result ? JSON.parse(result) : null;
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
      const parsed = JSON.parse(result);
      results.push(...(parsed.categorizations || []));
    }
  }

  return results;
}
