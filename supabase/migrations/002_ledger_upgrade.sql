-- Ledger-grade schema upgrade

-- Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'txn_status') THEN
        CREATE TYPE txn_status AS ENUM ('draft', 'posted', 'void');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
        CREATE TYPE review_status AS ENUM ('needs_review', 'approved');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_system') THEN
        CREATE TYPE source_system AS ENUM (
            'manual',
            'relay',
            'stripe',
            'gusto',
            'amex',
            'us_bank',
            'citi',
            'dcu',
            'sheffield',
            'other'
        );
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_class') THEN
        CREATE TYPE account_class AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'normal_balance') THEN
        CREATE TYPE normal_balance AS ENUM ('debit', 'credit');
    END IF;
END$$;

-- Ensure update trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- New tables
CREATE TABLE IF NOT EXISTS payees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payees_name ON payees (LOWER(name));

CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source source_system NOT NULL DEFAULT 'manual',
    source_id TEXT,
    file_name TEXT,
    metadata JSONB,
    created_by TEXT,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    before_json JSONB,
    after_json JSONB,
    actor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_actions_transaction ON review_actions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction ON transaction_splits(transaction_id);

-- Accounts table additions
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_class account_class;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS normal_balance normal_balance;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS terrain_account_code TEXT;

-- Categories table additions
ALTER TABLE categories ADD COLUMN IF NOT EXISTS account_class account_class;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS normal_balance normal_balance;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS terrain_category_code TEXT;

-- Transactions table additions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source source_system;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_hash TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payee_id UUID REFERENCES payees(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payee_original TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payee_display TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS primary_category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS review_status review_status DEFAULT 'needs_review';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_group_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS posted_at DATE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS txn_status txn_status DEFAULT 'posted';

CREATE INDEX IF NOT EXISTS idx_transactions_source_id ON transactions(source, source_id);
CREATE INDEX IF NOT EXISTS idx_transactions_source_hash ON transactions(source_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_review_status ON transactions(review_status);
CREATE INDEX IF NOT EXISTS idx_transactions_primary_category ON transactions(primary_category_id);

-- Payroll entries additions
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS source source_system;
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS source_hash TEXT;
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

-- Stripe payments additions
ALTER TABLE stripe_payments ADD COLUMN IF NOT EXISTS source source_system;
ALTER TABLE stripe_payments ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE stripe_payments ADD COLUMN IF NOT EXISTS source_hash TEXT;
ALTER TABLE stripe_payments ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

-- Jobs additions
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source source_system;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_hash TEXT;

-- Update triggers for new tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payees_updated_at') THEN
        CREATE TRIGGER update_payees_updated_at BEFORE UPDATE ON payees
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_import_batches_updated_at') THEN
        CREATE TRIGGER update_import_batches_updated_at BEFORE UPDATE ON import_batches
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_transaction_splits_updated_at') THEN
        CREATE TRIGGER update_transaction_splits_updated_at BEFORE UPDATE ON transaction_splits
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;
