// Type definitions for Landscape Finance

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'investment';
export type TransactionStatus = 'SETTLED' | 'PENDING' | 'APPROVED' | 'CANCELLED';
export type TxnStatus = 'draft' | 'posted' | 'void';
export type ReviewStatus = 'needs_review' | 'approved';
export type SourceSystem =
  | 'manual'
  | 'relay'
  | 'stripe'
  | 'gusto'
  | 'amex'
  | 'us_bank'
  | 'citi'
  | 'dcu'
  | 'sheffield'
  | 'other';
export type AccountClass = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';
export type CategoryType = 'income' | 'cogs' | 'expense' | 'other_income' | 'other_expense';
export type JobStatus = 'active' | 'completed' | 'cancelled';

export interface Account {
  id: string;
  name: string;
  account_number?: string;
  type: AccountType;
  institution?: string;
  is_active: boolean;
  opening_balance: number;
  current_balance: number;
  notes?: string;
  account_class?: AccountClass | null;
  normal_balance?: NormalBalance | null;
  terrain_account_code?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  parent_id?: string;
  type: CategoryType;
  section?: string;
  is_tax_deductible: boolean;
  qb_equivalent?: string;
  sort_order: number;
  account_class?: AccountClass | null;
  normal_balance?: NormalBalance | null;
  terrain_category_code?: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields
  parent?: Category;
  subcategories?: Category[];
}

export interface Job {
  id: string;
  customer_name: string;
  job_name?: string;
  terrain_id?: string;
  status: JobStatus;
  quoted_amount?: number;
  actual_revenue: number;
  actual_expenses: number;
  notes?: string;
  source?: SourceSystem | null;
  source_id?: string | null;
  source_hash?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  date: string;
  payee: string;
  description?: string;
  amount: number;
  category_id?: string;
  subcategory_id?: string;
  primary_category_id?: string;
  job_id?: string;
  is_transfer: boolean;
  transfer_to_account_id?: string;
  transfer_group_id?: string | null;
  payment_method?: string;
  reference?: string;
  status: TransactionStatus;
  txn_status?: TxnStatus | null;
  source?: SourceSystem | null;
  source_id?: string | null;
  source_hash?: string | null;
  payee_id?: string | null;
  payee_original?: string | null;
  payee_display?: string | null;
  import_batch_id?: string | null;
  receipt_url?: string;
  ai_suggested_category?: string;
  ai_confidence?: number;
  reviewed: boolean;
  reviewed_at?: string;
  review_status?: ReviewStatus | null;
  approved_at?: string | null;
  approved_by?: string | null;
  is_split?: boolean | null;
  posted_at?: string | null;
  notes?: string;
  raw_csv_data?: any;
  created_at: string;
  updated_at: string;
  // Joined fields
  account?: Account;
  category?: Category;
  subcategory?: Category;
  job?: Job;
  ai_suggested_category_name?: string;
}

export interface CategorizationRule {
  id: string;
  payee_pattern: string;
  description_pattern?: string;
  category_id: string;
  subcategory_id?: string;
  confidence: number;
  times_applied: number;
  last_used?: string;
  created_by: 'user' | 'ai';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: Category;
  subcategory?: Category;
}

export interface PayrollEntry {
  id: string;
  gusto_id?: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  gross_wages: number;
  payroll_taxes: number;
  net_pay: number;
  worker_comp: number;
  employee_name?: string;
  department?: string;
  raw_data?: any;
  source?: SourceSystem | null;
  source_id?: string | null;
  source_hash?: string | null;
  import_batch_id?: string | null;
  imported_at: string;
  created_at: string;
}

export interface StripePayment {
  id: string;
  stripe_id: string;
  customer_email?: string;
  customer_name?: string;
  amount: number;
  fee: number;
  net: number;
  payment_date: string;
  job_id?: string;
  status?: string;
  raw_data?: any;
  source?: SourceSystem | null;
  source_id?: string | null;
  source_hash?: string | null;
  import_batch_id?: string | null;
  synced_at: string;
  created_at: string;
  // Joined fields
  job?: Job;
}

// CSV Upload types
export interface CSVRow {
  [key: string]: string;
}

export interface ParsedTransaction {
  date: string;
  payee: string;
  description?: string;
  amount: number;
  reference?: string;
  status?: TransactionStatus;
  source_system?: SourceSystem;
  account_number?: string;
  balance?: number;
  raw_data: CSVRow;
}

export interface CSVUploadResult {
  success: boolean;
  parsed_count: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  errors?: string[];
  transactions?: Transaction[];
}

export interface Payee {
  id: string;
  name: string;
  display_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportBatch {
  id: string;
  source: SourceSystem;
  source_id?: string | null;
  file_name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewAction {
  id: string;
  transaction_id: string;
  action: 'approve' | 'reclass';
  before_json?: Record<string, unknown> | null;
  after_json?: Record<string, unknown> | null;
  actor?: string | null;
  created_at: string;
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  account_id?: string | null;
  category_id?: string | null;
  amount: number;
  memo?: string | null;
  created_at: string;
  updated_at: string;
}

// AI Categorization types
export interface CategorizationSuggestion {
  category_id: string;
  subcategory_id?: string;
  confidence: number;
  reasoning?: string;
}

// Report types
export interface PLReportLine {
  category_id: string;
  category_name: string;
  parent_category?: string;
  section: string;
  amount: number;
  is_parent: boolean;
  indent_level: number;
}

export interface PLReport {
  period_start: string;
  period_end: string;
  total_income: number;
  total_cogs: number;
  gross_profit: number;
  total_expenses: number;
  net_operating_income: number;
  other_income: number;
  other_expenses: number;
  net_income: number;
  lines: PLReportLine[];
}

export interface CashFlowData {
  date: string;
  cash_in: number;
  cash_out: number;
  net_change: number;
  ending_balance: number;
}

export interface WeeklySummary {
  week_start: string;
  week_end: string;
  total_income: number;
  total_expenses: number;
  net_change: number;
  transaction_count: number;
  unreviewed_count: number;
  top_expenses: Array<{
    payee: string;
    amount: number;
    category: string;
  }>;
}

// Dashboard types
export interface DashboardStats {
  current_cash: number;
  monthly_revenue: number;
  monthly_expenses: number;
  monthly_profit: number;
  ytd_revenue: number;
  ytd_expenses: number;
  ytd_profit: number;
  unreviewed_transactions: number;
  pending_categorizations: number;
}
