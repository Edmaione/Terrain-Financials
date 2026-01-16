import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract structured data from a PDF using GPT-4 Vision
 */
export async function extractPDFData(base64PDF: string, extractionType: 'receipt' | 'statement' | 'invoice') {
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
  const categoryList = availableCategories
    .map(c => `- ${c.name} (${c.section})`)
    .join('\n');

  const historyContext = historicalTransactions?.length
    ? `\n\nHistorical patterns:\n${historicalTransactions
        .slice(0, 5)
        .map(t => `${t.payee} → ${t.category}`)
        .join('\n')}`
    : '';

  const prompt = `You are categorizing a business expense for a landscaping company (S-corp).

Transaction details:
- Payee: ${payee}
- Description: ${description || 'N/A'}
- Amount: $${Math.abs(amount).toFixed(2)}

Available categories:
${categoryList}
${historyContext}

Based on the transaction details, which category is most appropriate?

Return JSON with:
{
  "category_name": "exact category name from the list",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a financial categorization assistant. Always return valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 200,
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
