import Papa from 'papaparse';
import { ParsedTransaction, CSVRow, TransactionStatus } from '@/types';

/**
 * Parse CSV file and extract transactions
 * Handles multiple bank formats including Relay
 */
export async function parseCSV(file: File): Promise<ParsedTransaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions = detectFormatAndParse(results.data as CSVRow[]);
          resolve(transactions);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

/**
 * Parse CSV text (Node/test harness friendly)
 */
export function parseCSVText(csvText: string): ParsedTransaction[] {
  const results = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (results.errors.length > 0) {
    const firstError = results.errors[0];
    throw new Error(firstError.message);
  }

  return detectFormatAndParse(results.data as CSVRow[]);
}

/**
 * Detect CSV format and parse accordingly
 */
function detectFormatAndParse(rows: CSVRow[]): ParsedTransaction[] {
  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0];
  const headers = Object.keys(firstRow).map(h => h.toLowerCase());

  // Relay format detection
  if (headers.includes('payee') && headers.includes('transaction type')) {
    return parseRelayFormat(rows);
  }

  // Chase format
  if (headers.includes('posting date') && headers.includes('description')) {
    return parseChaseFormat(rows);
  }

  // Bank of America format
  if (headers.includes('posted date') && headers.includes('payee')) {
    return parseBofAFormat(rows);
  }

  // Generic format (try to intelligently map columns)
  return parseGenericFormat(rows);
}

/**
 * Parse Relay bank CSV format
 * Format: Date,Payee,Account #,Transaction Type,Description,Reference,Status,Amount,Currency,Balance
 */
function parseRelayFormat(rows: CSVRow[]): ParsedTransaction[] {
  return rows.map(row => {
    const amount = parseAmount(row.Amount);
    const date = parseDate(row.Date);
    const isTransfer = row['Account #'] && row['Account #'].trim() !== '';

    return {
      date,
      payee: row.Payee || 'Unknown',
      description: row.Description || row.Reference || '',
      amount,
      reference: row.Reference || '',
      status: (row.Status?.toUpperCase() as TransactionStatus) || 'SETTLED',
      source_system: 'relay',
      account_number: row['Account #'] || undefined,
      balance: row.Balance ? parseFloat(row.Balance) : undefined,
      raw_data: row,
    };
  });
}

/**
 * Parse Chase bank CSV format
 */
function parseChaseFormat(rows: CSVRow[]): ParsedTransaction[] {
  return rows.map(row => {
    const amount = parseAmount(row.Amount);
    const date = parseDate(row['Posting Date'] || row['Transaction Date']);

    return {
      date,
      payee: row.Description || 'Unknown',
      description: row.Details || row.Memo || '',
      amount,
      reference: row['Check or Slip #'] || '',
      status: 'SETTLED' as TransactionStatus,
      source_system: 'other',
      balance: row.Balance ? parseFloat(row.Balance) : undefined,
      raw_data: row,
    };
  });
}

/**
 * Parse Bank of America CSV format
 */
function parseBofAFormat(rows: CSVRow[]): ParsedTransaction[] {
  return rows.map(row => {
    const date = parseDate(row['Posted Date']);
    const amount = parseAmount(row.Amount);

    return {
      date,
      payee: row.Payee || row.Description || 'Unknown',
      description: row.Address || '',
      amount,
      reference: row['Reference Number'] || '',
      status: 'SETTLED' as TransactionStatus,
      source_system: 'other',
      balance: row['Running Balance'] ? parseFloat(row['Running Balance']) : undefined,
      raw_data: row,
    };
  });
}

/**
 * Generic parser - attempts to intelligently map columns
 */
function parseGenericFormat(rows: CSVRow[]): ParsedTransaction[] {
  const firstRow = rows[0];
  const headers = Object.keys(firstRow).map(h => h.toLowerCase());

  // Find date column
  const dateCol = headers.find(h => 
    h.includes('date') || h.includes('posted') || h.includes('transaction')
  );

  // Find amount column
  const amountCol = headers.find(h => 
    h.includes('amount') || h.includes('debit') || h.includes('credit')
  );

  // Find description/payee column
  const descCol = headers.find(h => 
    h.includes('description') || h.includes('payee') || h.includes('merchant')
  );

  if (!dateCol || !amountCol) {
    throw new Error('Unable to detect required columns (date, amount) in CSV');
  }

  return rows.map(row => {
    const originalDateCol = Object.keys(firstRow)[headers.indexOf(dateCol)];
    const originalAmountCol = Object.keys(firstRow)[headers.indexOf(amountCol!)];
    const originalDescCol = descCol ? Object.keys(firstRow)[headers.indexOf(descCol)] : null;

    const date = parseDate(row[originalDateCol]);
    const amount = parseAmount(row[originalAmountCol]);

    return {
      date,
      payee: originalDescCol ? row[originalDescCol] : 'Unknown',
      description: '',
      amount,
      reference: '',
      status: 'SETTLED' as TransactionStatus,
      source_system: 'other',
      raw_data: row,
    };
  });
}

/**
 * Parse date string to YYYY-MM-DD format
 */
function parseDate(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString().split('T')[0];
  }

  // Try parsing common formats
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    // Try MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    throw new Error(`Unable to parse date: ${dateStr}`);
  }

  return date.toISOString().split('T')[0];
}

/**
 * Parse amount string to number
 * Handles negative signs, parentheses for negatives, commas, currency symbols
 */
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;

  // Remove currency symbols and whitespace
  let cleaned = amountStr.replace(/[$,\s]/g, '');

  // Handle parentheses for negative (accounting format)
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  const amount = parseFloat(cleaned);
  
  if (isNaN(amount)) {
    console.warn(`Unable to parse amount: ${amountStr}, defaulting to 0`);
    return 0;
  }

  return amount;
}

/**
 * Detect if a transaction looks like an internal transfer
 */
export function isLikelyTransfer(payee: string, description: string, accountNumber?: string): boolean {
  const lowerPayee = payee.toLowerCase();
  const lowerDesc = description?.toLowerCase() || '';

  // Has account number (Relay format)
  if (accountNumber && accountNumber.trim() !== '') {
    return true;
  }

  // Common transfer keywords
  const transferKeywords = [
    'transfer',
    'profit',
    'income account',
    'debt paydown',
    'automation',
  ];

  return transferKeywords.some(keyword => 
    lowerPayee.includes(keyword) || lowerDesc.includes(keyword)
  );
}

/**
 * Detect duplicate transactions across different CSVs
 * Returns true if transaction appears to be a duplicate
 */
export function isDuplicateTransaction(
  transaction: ParsedTransaction,
  existingTransactions: Array<{
    date: string;
    payee: string;
    amount: number;
  }>
): boolean {
  return existingTransactions.some(existing => {
    // Same date, same payee, same amount (or very close due to rounding)
    const sameDate = existing.date === transaction.date;
    const samePayee = existing.payee.toLowerCase() === transaction.payee.toLowerCase();
    const amountDiff = Math.abs(existing.amount - transaction.amount);
    const sameAmount = amountDiff < 0.01; // Within 1 cent

    return sameDate && samePayee && sameAmount;
  });
}
