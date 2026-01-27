import type { QBRow, QBAccountMap, QBTransformResult } from './types';

let transferGroupCounter = 0;
function nextTransferGroupId(): string {
  transferGroupCounter++;
  return `qb-transfer-${Date.now()}-${transferGroupCounter}`;
}

export interface TransformStats {
  expenses: number;
  income: number;
  transfers: number;
  journalEntries: number;
  errors: string[];
}

/**
 * Transform QB double-entry rows into single-entry transactions.
 * Returns an array of transactions plus stats.
 */
export function transformQBRows(
  rows: QBRow[],
  accountMap: QBAccountMap
): { transactions: QBTransformResult[]; stats: TransformStats } {
  const transactions: QBTransformResult[] = [];
  const stats: TransformStats = { expenses: 0, income: 0, transfers: 0, journalEntries: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const debitName = row.PrimaryDebitAccount?.trim();
    const creditName = row.PrimaryCreditAccount?.trim();
    const debitAmount = parseFloat(row.PrimaryDebitAmount) || 0;
    const creditAmount = parseFloat(row.PrimaryCreditAmount) || 0;

    if (!debitName && !creditName) {
      stats.errors.push(`Row ${i + 1}: No debit or credit account`);
      continue;
    }

    const debitMapping = debitName ? accountMap[debitName] : undefined;
    const creditMapping = creditName ? accountMap[creditName] : undefined;

    if (debitName && !debitMapping) {
      stats.errors.push(`Row ${i + 1}: Unmapped debit account "${debitName}"`);
      continue;
    }
    if (creditName && !creditMapping) {
      stats.errors.push(`Row ${i + 1}: Unmapped credit account "${creditName}"`);
      continue;
    }

    const debitIsBankAccount = debitMapping?.type === 'bank_account';
    const creditIsBankAccount = creditMapping?.type === 'bank_account';

    const sourceId = `qb-${row.Date}-${row.Num || i}-${debitName}-${creditName}`;
    const baseTxn = {
      date: row.Date,
      payee: row.Name || '',
      memo: row.Memo || undefined,
      reference: row.Num || undefined,
      notes: row.Ed_Notes || undefined,
      sourceId,
      rawCsvData: { ...row },
    };

    if (debitIsBankAccount && creditIsBankAccount) {
      // Transfer: both sides are bank accounts
      const groupId = nextTransferGroupId();
      const amount = debitAmount || creditAmount;

      // Debit side: money coming IN to debit account
      transactions.push({
        ...baseTxn,
        accountId: debitMapping!.systemId!,
        amount: amount,
        isTransfer: true,
        transferGroupId: groupId,
        sourceId: `${sourceId}-debit`,
      });

      // Credit side: money going OUT of credit account
      transactions.push({
        ...baseTxn,
        accountId: creditMapping!.systemId!,
        amount: -amount,
        isTransfer: true,
        transferGroupId: groupId,
        sourceId: `${sourceId}-credit`,
      });

      stats.transfers++;
    } else if (debitIsBankAccount && !creditIsBankAccount) {
      // Income/Deposit: money into bank, from category
      transactions.push({
        ...baseTxn,
        accountId: debitMapping!.systemId!,
        amount: debitAmount,
        categoryId: creditMapping?.systemId,
        isTransfer: false,
      });
      stats.income++;
    } else if (!debitIsBankAccount && creditIsBankAccount) {
      // Expense: money out of bank, to category
      transactions.push({
        ...baseTxn,
        accountId: creditMapping!.systemId!,
        amount: -creditAmount,
        categoryId: debitMapping?.systemId,
        isTransfer: false,
      });
      stats.expenses++;
    } else {
      // Journal entry: both are categories, no bank account movement
      stats.journalEntries++;
    }
  }

  return { transactions, stats };
}
