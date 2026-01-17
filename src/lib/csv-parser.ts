import Papa from 'papaparse';
import { CSVRow, ParsedCSV } from '@/types';

/**
 * Parse CSV file and extract transactions
 * Handles multiple bank formats including Relay
 */
export async function parseCSV(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as CSVRow[];
          const headers = results.meta.fields ?? (rows[0] ? Object.keys(rows[0]) : []);
          resolve({ headers, rows });
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
export function parseCSVText(csvText: string): ParsedCSV {
  const results = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (results.errors.length > 0) {
    const firstError = results.errors[0];
    throw new Error(firstError.message);
  }

  const rows = results.data as CSVRow[];
  const headers = results.meta.fields ?? (rows[0] ? Object.keys(rows[0]) : []);

  return { headers, rows };
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
