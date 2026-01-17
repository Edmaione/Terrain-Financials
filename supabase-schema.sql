-- Initial schema for Landscape Finance System
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Account types enum
CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit_card', 'loan', 'investment');

-- Transaction status enum
CREATE TYPE transaction_status AS ENUM ('SETTLED', 'PENDING', 'APPROVED', 'CANCELLED');

-- Ledger-grade transaction status enum
CREATE TYPE txn_status AS ENUM ('draft', 'posted', 'void');

-- Review status enum
CREATE TYPE review_status AS ENUM ('needs_review', 'approved');

-- Source system enum
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

-- Account class enum
CREATE TYPE account_class AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');

-- Normal balance enum
CREATE TYPE normal_balance AS ENUM ('debit', 'credit');

-- Category types enum
CREATE TYPE category_type AS ENUM ('income', 'cogs', 'expense', 'other_income', 'other_expense');

-- Job status enum
CREATE TYPE job_status AS ENUM ('active', 'completed', 'cancelled');

-- ============================================================================
-- ACCOUNTS TABLE
-- ============================================================================
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    account_number TEXT, -- Last 4 digits or identifier
    type account_type NOT NULL,
    institution TEXT, -- "Relay", "Chase", etc.
    is_active BOOLEAN DEFAULT true,
    opening_balance DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    account_class account_class, -- asset/liability/etc
    normal_balance normal_balance,
    terrain_account_code TEXT, -- Terrain ledger account mapping
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    type category_type NOT NULL,
    section TEXT, -- "ADMIN", "OP FIXED", "LS COGS - Cost of Labor", etc.
    is_tax_deductible BOOLEAN DEFAULT true,
    qb_equivalent TEXT, -- Maps to QuickBooks category name for migration
    sort_order INTEGER DEFAULT 0,
    account_class account_class,
    normal_balance normal_balance,
    terrain_category_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- JOBS TABLE (Simple customer/project tracking)
-- ============================================================================
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT NOT NULL,
    job_name TEXT,
    terrain_id TEXT, -- Links to Terrain CRM
    status job_status DEFAULT 'active',
    quoted_amount DECIMAL(12,2),
    actual_revenue DECIMAL(12,2) DEFAULT 0,
    actual_expenses DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    source source_system,
    source_id TEXT,
    source_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PAYEES TABLE
-- ============================================================================
CREATE TABLE payees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- IMPORT BATCHES TABLE
-- ============================================================================
CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source source_system DEFAULT 'manual',
    source_id TEXT,
    file_name TEXT,
    metadata JSONB,
    created_by TEXT,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    payee TEXT NOT NULL,
    payee_id UUID REFERENCES payees(id) ON DELETE SET NULL,
    payee_original TEXT,
    payee_display TEXT,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL, -- Negative for expenses, positive for income
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    primary_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    
    -- Transfer tracking
    is_transfer BOOLEAN DEFAULT false,
    transfer_to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    transfer_group_id UUID,
    is_split BOOLEAN DEFAULT false,
    
    -- Transaction metadata
    payment_method TEXT, -- "ACH", "Check", "Card", "Wire", etc.
    reference TEXT, -- Check number, invoice number, confirmation code
    status transaction_status DEFAULT 'SETTLED',
    txn_status txn_status DEFAULT 'posted',
    source source_system DEFAULT 'manual',
    source_id TEXT,
    source_hash TEXT,
    posted_at DATE,
    
    -- Document storage
    receipt_url TEXT, -- Link to Supabase Storage
    
    -- AI categorization
    ai_suggested_category UUID REFERENCES categories(id) ON DELETE SET NULL,
    ai_confidence DECIMAL(3,2), -- 0.00 to 1.00
    reviewed BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_status review_status DEFAULT 'needs_review',
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    
    -- Notes and audit
    notes TEXT,
    raw_csv_data JSONB, -- Original CSV row for reference
    import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- REVIEW ACTIONS TABLE
-- ============================================================================
CREATE TABLE review_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    before_json JSONB,
    after_json JSONB,
    actor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TRANSACTION SPLITS TABLE
-- ============================================================================
CREATE TABLE transaction_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CATEGORIZATION RULES TABLE
-- ============================================================================
CREATE TABLE categorization_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payee_pattern TEXT NOT NULL, -- Regex or exact match
    description_pattern TEXT, -- Optional additional matching
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    subcategory_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    confidence DECIMAL(3,2) DEFAULT 0.95, -- How confident in this rule
    times_applied INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    created_by TEXT DEFAULT 'user', -- 'user' or 'ai'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PAYROLL ENTRIES TABLE
-- ============================================================================
CREATE TABLE payroll_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gusto_id TEXT UNIQUE,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    pay_date DATE NOT NULL,
    gross_wages DECIMAL(12,2) NOT NULL,
    payroll_taxes DECIMAL(12,2) NOT NULL,
    net_pay DECIMAL(12,2) NOT NULL,
    worker_comp DECIMAL(12,2) DEFAULT 0,
    employee_name TEXT,
    department TEXT, -- 'technician' or 'admin'
    raw_data JSONB, -- Full Gusto export data
    source source_system,
    source_id TEXT,
    source_hash TEXT,
    import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STRIPE PAYMENTS TABLE
-- ============================================================================
CREATE TABLE stripe_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_id TEXT UNIQUE NOT NULL,
    customer_email TEXT,
    customer_name TEXT,
    amount DECIMAL(12,2) NOT NULL,
    fee DECIMAL(12,2) NOT NULL,
    net DECIMAL(12,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    status TEXT,
    raw_data JSONB,
    source source_system,
    source_id TEXT,
    source_hash TEXT,
    import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_payee ON transactions(payee);
CREATE INDEX idx_transactions_reviewed ON transactions(reviewed) WHERE reviewed = false;
CREATE INDEX idx_transactions_source_id ON transactions(source, source_id);
CREATE INDEX idx_transactions_source_hash ON transactions(source_hash);
CREATE INDEX idx_transactions_review_status ON transactions(review_status);
CREATE INDEX idx_transactions_primary_category ON transactions(primary_category_id);
CREATE INDEX idx_categorization_rules_payee ON categorization_rules(payee_pattern);
CREATE INDEX idx_stripe_payments_date ON stripe_payments(payment_date DESC);
CREATE UNIQUE INDEX idx_payees_name ON payees(LOWER(name));
CREATE INDEX idx_review_actions_transaction ON review_actions(transaction_id);
CREATE INDEX idx_transaction_splits_transaction ON transaction_splits(transaction_id);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payees_updated_at BEFORE UPDATE ON payees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_batches_updated_at BEFORE UPDATE ON import_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_splits_updated_at BEFORE UPDATE ON transaction_splits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED CATEGORIES (Based on QuickBooks P&L Structure)
-- ============================================================================

-- Income
INSERT INTO categories (name, type, section, sort_order) VALUES
('Sales', 'income', 'Income', 1);

-- COGS - Cost of Labor
INSERT INTO categories (name, type, section, is_tax_deductible, sort_order) VALUES
('LS COGS - Cost of Labor', 'cogs', 'Cost of Goods Sold', true, 10);

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Technician Payroll taxes', 'cogs', 'Cost of Goods Sold', id, true, 'LS Technician Payroll taxes', 11
FROM categories WHERE name = 'LS COGS - Cost of Labor';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Technician Subcontractors', 'cogs', 'Cost of Goods Sold', id, true, 'LS Technician Subcontractors', 12
FROM categories WHERE name = 'LS COGS - Cost of Labor';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Technician Wages', 'cogs', 'Cost of Goods Sold', id, true, 'LS Technician Wages', 13
FROM categories WHERE name = 'LS COGS - Cost of Labor';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Workers Compensation', 'cogs', 'Cost of Goods Sold', id, true, 'LS Workers Compensation', 14
FROM categories WHERE name = 'LS COGS - Cost of Labor';

-- COGS - Other Costs
INSERT INTO categories (name, type, section, is_tax_deductible, sort_order) VALUES
('LS COGS - Other Costs', 'cogs', 'Cost of Goods Sold', true, 20);

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Disposal Fees', 'cogs', 'Cost of Goods Sold', id, true, 'LS Disposal Fees', 21
FROM categories WHERE name = 'LS COGS - Other Costs';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Fuel, Parking, Tolls', 'cogs', 'Cost of Goods Sold', id, true, 'LS Fuel, Parking, Tolls', 22
FROM categories WHERE name = 'LS COGS - Other Costs';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Merchant Fees', 'cogs', 'Cost of Goods Sold', id, true, 'LS Merchant Fees', 23
FROM categories WHERE name = 'LS COGS - Other Costs';

-- COGS - Supplies & Materials
INSERT INTO categories (name, type, section, is_tax_deductible, sort_order) VALUES
('LS COGS - Supplies & Materials', 'cogs', 'Cost of Goods Sold', true, 30);

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Equipment Rental', 'cogs', 'Cost of Goods Sold', id, true, 'LS Equipment Rental', 31
FROM categories WHERE name = 'LS COGS - Supplies & Materials';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Other Miscellaneous', 'cogs', 'Cost of Goods Sold', id, true, 'LS Other Miscellaneous', 32
FROM categories WHERE name = 'LS COGS - Supplies & Materials';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'LS Supplies & Chemicals', 'cogs', 'Cost of Goods Sold', id, true, 'LS Supplies & Chemicals', 33
FROM categories WHERE name = 'LS COGS - Supplies & Materials';

-- ADMIN
INSERT INTO categories (name, type, section, is_tax_deductible, sort_order) VALUES
('ADMIN', 'expense', 'Expenses', true, 40);

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Admin Payroll Taxes', 'expense', 'Expenses', id, true, 'Admin Payroll Taxes', 41
FROM categories WHERE name = 'ADMIN';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Owner Salary', 'expense', 'Expenses', id, true, 'Owner Salary', 42
FROM categories WHERE name = 'ADMIN';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Payroll Expenses & Fees', 'expense', 'Expenses', id, true, 'Payroll Expenses & Fees', 43
FROM categories WHERE name = 'ADMIN';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Virtual Assistant', 'expense', 'Expenses', id, true, 'Virtual Assistant', 44
FROM categories WHERE name = 'ADMIN';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Bank Charges', 'expense', 'Expenses', id, true, 'Bank Charges', 45
FROM categories WHERE name = 'ADMIN';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'IRA/401K Benefits', 'expense', 'Expenses', id, true, 'IRA/401K Benefits', 46
FROM categories WHERE name = 'ADMIN';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Accounting Services', 'expense', 'Expenses', id, true, 'Accounting Services', 47
FROM categories WHERE name = 'ADMIN';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Business Consulting', 'expense', 'Expenses', id, true, 'Business Consulting', 48
FROM categories WHERE name = 'ADMIN';

-- ADVERTISING & MARKETING
INSERT INTO categories (name, type, section, is_tax_deductible, sort_order) VALUES
('ADVERTISING & MARKETING', 'expense', 'Expenses', true, 50);

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Charitable Donation', 'expense', 'Expenses', id, true, 'Charitable Donation', 51
FROM categories WHERE name = 'ADVERTISING & MARKETING';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Marketing Ad Spend & Awareness', 'expense', 'Expenses', id, true, 'Marketing Ad Spend & Awareness', 52
FROM categories WHERE name = 'ADVERTISING & MARKETING';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Marketing Software & Website', 'expense', 'Expenses', id, true, 'Marketing Software & Website', 53
FROM categories WHERE name = 'ADVERTISING & MARKETING';

-- OP FIXED
INSERT INTO categories (name, type, section, is_tax_deductible, sort_order) VALUES
('OP FIXED', 'expense', 'Expenses', true, 60);

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Dues & Subscriptions', 'expense', 'Expenses', id, true, 'Dues & Subscriptions', 61
FROM categories WHERE name = 'OP FIXED';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Insurance - Liability & Auto', 'expense', 'Expenses', id, true, 'Insurance - Liability & Auto', 62
FROM categories WHERE name = 'OP FIXED';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Interest Expense', 'expense', 'Expenses', id, true, 'Interest Expense', 63
FROM categories WHERE name = 'OP FIXED';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Rent & Lease', 'expense', 'Expenses', id, true, 'Rent & Lease', 64
FROM categories WHERE name = 'OP FIXED';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Software Expense', 'expense', 'Expenses', id, true, 'Software Expense', 65
FROM categories WHERE name = 'OP FIXED';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Utilities, Phone, Internet', 'expense', 'Expenses', id, true, 'Utilities, Phone, Internet', 66
FROM categories WHERE name = 'OP FIXED';

-- OP VARIABLE
INSERT INTO categories (name, type, section, is_tax_deductible, sort_order) VALUES
('OP VARIABLE', 'expense', 'Expenses', true, 70);

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Education, Events, & Leadership Development', 'expense', 'Expenses', id, true, 'Education, Events, & Leadership Development', 71
FROM categories WHERE name = 'OP VARIABLE';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Meals & Entertainment', 'expense', 'Expenses', id, true, 'Meals & Entertainment', 72
FROM categories WHERE name = 'OP VARIABLE';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Recruiting', 'expense', 'Expenses', id, true, 'Recruiting', 73
FROM categories WHERE name = 'OP VARIABLE';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Repairs & Maintenance - Auto', 'expense', 'Expenses', id, true, 'Repairs & Maintenance - Auto', 74
FROM categories WHERE name = 'OP VARIABLE';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Repairs & Maintenance - Tools', 'expense', 'Expenses', id, true, 'Repairs & Maintenance - Tools', 75
FROM categories WHERE name = 'OP VARIABLE';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Taxes, Licenses, Penalties, Permits', 'expense', 'Expenses', id, true, 'Taxes, Licenses, Penalties, Permits', 76
FROM categories WHERE name = 'OP VARIABLE';

INSERT INTO categories (name, type, section, parent_id, is_tax_deductible, qb_equivalent, sort_order)
SELECT 'Travel Meals', 'expense', 'Expenses', id, true, 'Travel Meals', 77
FROM categories WHERE name = 'OP VARIABLE';

-- Other Income
INSERT INTO categories (name, type, section, is_tax_deductible, sort_order) VALUES
('Interest Income', 'other_income', 'Other Income', false, 80);

-- ============================================================================
-- SEED INITIAL CATEGORIZATION RULES (Based on sample CSV patterns)
-- ============================================================================
INSERT INTO categorization_rules (payee_pattern, category_id, confidence, created_by)
SELECT 'GUSTO.*TAX', id, 0.98, 'ai'
FROM categories WHERE name = 'LS Technician Payroll taxes';

INSERT INTO categorization_rules (payee_pattern, category_id, confidence, created_by)
SELECT 'GUSTO.*NET', id, 0.98, 'ai'
FROM categories WHERE name = 'LS Technician Wages';

INSERT INTO categorization_rules (payee_pattern, category_id, confidence, created_by)
SELECT 'GUSTO.*FEE', id, 0.98, 'ai'
FROM categories WHERE name = 'Payroll Expenses & Fees';

INSERT INTO categorization_rules (payee_pattern, category_id, confidence, created_by)
SELECT 'NEXT INSUR', id, 0.95, 'ai'
FROM categories WHERE name = 'Insurance - Liability & Auto';

INSERT INTO categorization_rules (payee_pattern, category_id, confidence, created_by)
SELECT 'HANOVER INS', id, 0.95, 'ai'
FROM categories WHERE name = 'Insurance - Liability & Auto';

INSERT INTO categorization_rules (payee_pattern, category_id, confidence, created_by)
SELECT 'T-MOBILE', id, 0.98, 'ai'
FROM categories WHERE name = 'Utilities, Phone, Internet';

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE accounts IS 'Bank accounts, credit cards, loans tracked in the system';
COMMENT ON TABLE transactions IS 'All financial transactions from all sources';
COMMENT ON TABLE categories IS 'Chart of accounts matching QuickBooks structure';
COMMENT ON TABLE jobs IS 'Simple customer/project tracking for job costing';
COMMENT ON TABLE categorization_rules IS 'Rules for auto-categorizing transactions';
COMMENT ON TABLE payroll_entries IS 'Imported payroll data from Gusto';
COMMENT ON TABLE stripe_payments IS 'Customer payments from Stripe';
