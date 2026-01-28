// Type definitions for Landscape Finance

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'investment';
export type TransactionStatus = 'pending' | 'posted' | 'reconciled';
export type BankStatus = 'pending' | 'posted';
export type ReconciliationStatus = 'unreconciled' | 'cleared' | 'reconciled';
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
  | 'quickbooks'
  | 'pdf_statement'
  | 'other';
export type AccountClass = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';
export type CategoryType = 'income' | 'cogs' | 'expense' | 'other_income' | 'other_expense';
export type JobStatus = 'active' | 'completed' | 'cancelled';
export type ImportStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface Account {
  id: string;
  name: string;
  account_number?: string;
  last4?: string | null;
  type: AccountType;
  institution?: string;
  is_active: boolean;
  opening_balance: number;
  opening_balance_date: string | null;
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
  memo?: string;
  amount: number;
  customer_id?: string;
  vendor_id?: string;
  category_id?: string;
  subcategory_id?: string;
  primary_category_id?: string;
  job_id?: string;
  is_transfer: boolean;
  transfer_to_account_id?: string;
  transfer_group_id?: string | null;
  payment_method?: string;
  reference?: string;
  status?: TransactionStatus | null;
  txn_status?: TxnStatus | null;
  bank_status?: BankStatus | null;
  reconciliation_status?: ReconciliationStatus | null;
  cleared_at?: string | null;
  reconciled_at?: string | null;
  voided_at?: string | null;
  deleted_at?: string | null;
  posted_at?: string | null;
  source?: SourceSystem | null;
  source_id?: string | null;
  source_hash?: string | null;
  payee_id?: string | null;
  payee_original?: string | null;
  payee_display?: string | null;
  import_batch_id?: string | null;
  import_id?: string | null;
  import_row_number?: number | null;
  import_row_hash?: string | null;
  receipt_url?: string;
  ai_suggested_category?: string;
  ai_confidence?: number;
  reviewed: boolean;
  reviewed_at?: string;
  review_status?: ReviewStatus | null;
  approved_at?: string | null;
  approved_by?: string | null;
  applied_rule_id?: string | null;
  is_split?: boolean | null;
  notes?: string;
  raw_csv_data?: any;
  created_at: string;
  updated_at: string;
  // Joined fields
  account?: Account;
  customer?: Customer;
  vendor?: Vendor;
  transfer_to_account?: Account;
  category?: Category;
  subcategory?: Category;
  job?: Job;
  ai_suggested_category_name?: string;
  // Computed fields
  spent?: number;
  received?: number;
}

export interface CategorizationRule {
  id: string;
  payee_pattern: string;
  payee_pattern_normalized?: string | null;
  description_pattern?: string;
  category_id: string;
  subcategory_id?: string;
  confidence: number;
  times_applied: number;
  times_correct?: number;
  times_wrong?: number;
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

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface Vendor {
  id: string;
  name: string;
  category?: string;
}

export interface AccountSummary {
  account: Account;
  balance: number;
  pending_count: number;
  unreviewed_count: number;
  last_transaction_date: string;
}

// CSV Upload types
export interface CSVRow {
  [key: string]: string;
}

export interface ParsedCSV {
  headers: string[];
  rows: CSVRow[];
}

export type AmountStrategy = 'signed' | 'inflow_outflow';

export interface ImportFieldMapping {
  date: string | null;
  amount: string | null;
  inflow: string | null;
  outflow: string | null;
  payee: string | null;
  description: string | null;
  memo: string | null;
  reference: string | null;
  category: string | null;
  bank_status: string | null;
}

export interface ParsedTransaction {
  date: string;
  payee: string;
  description?: string | null;
  memo?: string | null;
  amount: number;
  category?: string | null;
  reference?: string | null;
  bank_status?: BankStatus | null;
  reconciliation_status?: ReconciliationStatus | null;
  bank_status_raw?: string | null;
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

export interface ImportRecord {
  id: string;
  account_id: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  file_name?: string | null;
  file_size?: number | null;
  file_sha256?: string | null;
  status: ImportStatus;
  canceled_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  total_rows?: number | null;
  processed_rows?: number | null;
  inserted_rows?: number | null;
  skipped_rows?: number | null;
  error_rows?: number | null;
  last_error?: string | null;
  detected_institution?: string | null;
  detected_account_last4?: string | null;
  detected_account_number?: string | null;
  detected_statement_account_name?: string | null;
  detection_method?: string | null;
  detection_confidence?: number | null;
  detection_reason?: string | null;
  profile_id?: string | null;
  preflight?: Record<string, unknown> | null;
}

export interface ImportProfile {
  id: string;
  institution: string;
  header_signature: string;
  column_map: ImportFieldMapping;
  transforms: Record<string, unknown>;
  status_map: Record<string, string>;
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

// CFO Reporting Package types

export interface PLComparisonLine {
  category_id: string;
  category_name: string;
  section: string;
  indent_level: number;
  is_parent: boolean;
  current_amount: number;
  previous_amount: number;
  variance_amount: number;
  variance_percent: number | null; // null when previous is 0
}

export interface PLComparisonReport {
  current: PLReport;
  previous: PLReport;
  comparison_label: string; // e.g. "Prior Year", "Prior Period"
  lines: PLComparisonLine[];
}

export interface MonthlyBucket {
  month: string;  // "2025-01"
  label: string;  // "Jan"
  amount: number;
}

export interface IncomeExpenseTrend {
  months: Array<{
    month: string;
    label: string;
    income: number;
    cogs: number;
    expenses: number;
    net: number;
    margin_percent: number | null;
  }>;
  avg_income: number;
  avg_expenses: number;
  avg_net: number;
  best_month: { month: string; net: number };
  worst_month: { month: string; net: number };
}

export interface CategoryMonthlyTrend {
  category_id: string;
  category_name: string;
  buckets: MonthlyBucket[];
  total: number;
  monthly_avg: number;
}

export interface ExpenseTrendReport {
  months: string[];      // ["2025-01", "2025-02", ...]
  month_labels: string[]; // ["Jan", "Feb", ...]
  categories: CategoryMonthlyTrend[];
}

export interface TaxSummaryLine {
  category_id: string;
  category_name: string;
  qb_equivalent: string | null;
  section: string;
  amount: number;
  transaction_count: number;
}

export interface TaxSummaryReport {
  period_start: string;
  period_end: string;
  lines: TaxSummaryLine[];
  total_deductible: number;
}

export interface AccountBalanceSummary {
  account_id: string;
  account_name: string;
  account_type: AccountType;
  institution: string | null;
  balance: number;
  transaction_count: number;
  period_inflows: number;
  period_outflows: number;
  last_activity_date: string | null;
}

export interface AccountBalancesReport {
  accounts: AccountBalanceSummary[];
  total_cash: number;
  total_cc_debt: number;
  total_loan_balance: number;
}

export interface PayeeAnalysis {
  payee: string;
  total_amount: number;
  transaction_count: number;
  categories: Array<{ category_name: string; amount: number }>;
  first_date: string;
  last_date: string;
}

export interface PayeeAnalysisReport {
  payees: PayeeAnalysis[];
}

export interface OwnerEquitySummary {
  lines: Array<{
    category_id: string;
    category_name: string;
    amount: number;
    transaction_count: number;
  }>;
  total_draws: number;
  total_salary: number;
  total_tax_payments: number;
  total_loan_payments: number;
  grand_total: number;
}

export interface GrossMarginReport {
  months: Array<{
    month: string;
    label: string;
    income: number;
    cogs: number;
    gross_profit: number;
    margin_percent: number | null;
  }>;
  current_margin: number | null;
  trailing_avg_margin: number | null;
  cogs_breakdown: CategoryMonthlyTrend[];
}

// Reconciliation types
export type StatementStatus = 'pending' | 'in_progress' | 'reconciled';

export interface ExtractedTransaction {
  date: string;
  description: string;
  amount: number;
}

export interface BankStatement {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  ending_balance: number;
  beginning_balance: number | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  import_id: string | null;
  status: StatementStatus;
  reconciled_at: string | null;
  notes: string | null;
  extracted_data: ExtractedStatementData | null;
  unmatched_transactions: ExtractedTransaction[] | null;
  created_at: string;
  updated_at: string;
  // Joined
  account?: Account;
}

export interface ReconciliationSummary {
  statement: BankStatement;
  beginning_balance: number;
  cleared_deposits: number;
  cleared_withdrawals: number;
  computed_ending_balance: number;
  difference: number;
  cleared_count: number;
  uncleared_count: number;
  is_credit_card: boolean;
  transactions: Array<Transaction & { is_cleared: boolean }>;
  unmatched_statement_transactions: ExtractedTransaction[];
}

export interface ExtractedStatementData {
  account_type: 'checking' | 'savings' | 'credit_card' | 'loan';
  account_number_last4: string | null;
  period_start: string;
  period_end: string;
  beginning_balance: number;
  ending_balance: number;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
}

export interface StatementGridCell {
  account_id: string;
  account_name: string;
  month: string; // "2025-01"
  statement_id: string | null;
  status: StatementStatus | null;
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
