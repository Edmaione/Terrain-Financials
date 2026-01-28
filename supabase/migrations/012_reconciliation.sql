-- Bank Statement Reconciliation
-- Tables for storing bank statements and tracking reconciliation

CREATE TABLE bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  ending_balance numeric(12,2) NOT NULL,
  beginning_balance numeric(12,2),
  file_url text,
  file_name text,
  file_type text,          -- 'pdf' | 'csv' | 'png' | 'jpg'
  file_size integer,
  import_id uuid REFERENCES imports(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','reconciled')),
  reconciled_at timestamptz,
  notes text,
  extracted_data jsonb,       -- Full PDF extraction result (for reference/debugging)
  unmatched_transactions jsonb, -- Transactions on statement but not matched to DB
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT period_valid CHECK (period_end >= period_start),
  UNIQUE (account_id, period_start, period_end)
);

CREATE TABLE statement_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  matched_at timestamptz NOT NULL DEFAULT now(),
  match_method text DEFAULT 'manual',  -- 'manual' | 'auto_hash'
  UNIQUE (statement_id, transaction_id)
);

-- Flexible opening balance date (not always month-end)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS opening_balance_date date;

-- Indexes
CREATE INDEX idx_bank_statements_account ON bank_statements(account_id);
CREATE INDEX idx_bank_statements_status ON bank_statements(status);
CREATE INDEX idx_bank_statements_period ON bank_statements(account_id, period_end DESC);
CREATE INDEX idx_statement_txns_stmt ON statement_transactions(statement_id);
CREATE INDEX idx_statement_txns_txn ON statement_transactions(transaction_id);
