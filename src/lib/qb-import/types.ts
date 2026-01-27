/** Parsed row from QuickBooks General Ledger CSV export */
export interface QBRow {
  Date: string;
  Num: string;
  Name: string;
  Memo: string;
  PrimaryDebitAccount: string;
  PrimaryDebitAmount: string;
  PrimaryCreditAccount: string;
  PrimaryCreditAmount: string;
  Ed_Notes?: string;
  [key: string]: string | undefined;
}

export type QBAccountType = 'bank_account' | 'category';

export interface QBAccountClassification {
  qbName: string;
  type: QBAccountType;
  confidence: number;
  systemId?: string;
  suggestedAccountType?: 'checking' | 'credit_card' | 'loan' | 'savings';
  suggestedCategoryType?: 'income' | 'cogs' | 'expense' | 'other_income' | 'other_expense';
  isDeleted?: boolean;
  /** Original name before stripping (deleted) suffix */
  originalName?: string;
}

/** User-confirmed mapping of QB account names to system entities */
export type QBAccountMap = Record<string, {
  type: QBAccountType;
  systemId?: string;
  /** For new accounts/categories to be created */
  createAs?: {
    name: string;
    accountType?: 'checking' | 'credit_card' | 'loan' | 'savings';
    categoryType?: 'income' | 'cogs' | 'expense' | 'other_income' | 'other_expense';
    parentName?: string;
    institution?: string;
  };
}>;

export interface QBTransformResult {
  accountId: string;
  date: string;
  payee: string;
  memo?: string;
  amount: number;
  categoryId?: string;
  reference?: string;
  isTransfer: boolean;
  transferGroupId?: string;
  sourceId: string;
  notes?: string;
  rawCsvData: Record<string, string | undefined>;
}

export interface QBAnalysisResult {
  classifications: QBAccountClassification[];
  stats: {
    totalRows: number;
    dateRange: { start: string; end: string };
    uniqueAccounts: number;
    transactionTypes: {
      expenses: number;
      income: number;
      transfers: number;
      journalEntries: number;
    };
  };
}

export interface QBExecuteResult {
  importId: string;
  created: {
    accounts: number;
    categories: number;
  };
  transactions: {
    total: number;
    inserted: number;
    transfers: number;
    skipped: number;
    errors: number;
  };
}
