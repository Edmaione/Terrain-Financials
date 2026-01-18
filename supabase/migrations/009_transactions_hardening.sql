BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bank_status') THEN
    CREATE TYPE bank_status AS ENUM ('pending', 'posted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reconciliation_status') THEN
    CREATE TYPE reconciliation_status AS ENUM ('unreconciled', 'cleared', 'reconciled');
  END IF;
END $$;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bank_status bank_status,
  ADD COLUMN IF NOT EXISTS reconciliation_status reconciliation_status,
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE transaction_splits
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payee_id uuid REFERENCES payees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_number integer,
  ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE transaction_audit
  ADD COLUMN IF NOT EXISTS split_id uuid REFERENCES transaction_splits(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS before_json jsonb,
  ADD COLUMN IF NOT EXISTS after_json jsonb;

UPDATE transactions
SET bank_status = CASE
  WHEN status = 'PENDING' THEN 'pending'
  WHEN txn_status = 'draft' THEN 'pending'
  ELSE 'posted'
END
WHERE bank_status IS NULL;

UPDATE transactions
SET reconciliation_status = CASE
  WHEN reconciled_at IS NOT NULL THEN 'reconciled'
  WHEN cleared_at IS NOT NULL THEN 'cleared'
  ELSE 'unreconciled'
END
WHERE reconciliation_status IS NULL;

UPDATE transactions
SET voided_at = COALESCE(voided_at, NOW())
WHERE voided_at IS NULL
  AND status = 'CANCELLED';

UPDATE transactions
SET review_status = 'approved'
WHERE review_status IS NULL
  AND (reviewed = true OR approved_at IS NOT NULL);

UPDATE transactions
SET reviewed = (review_status = 'approved')
WHERE reviewed IS DISTINCT FROM (review_status = 'approved');

UPDATE transactions t
SET is_split = EXISTS (
  SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id
)
WHERE is_split IS DISTINCT FROM EXISTS (
  SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id
);

WITH grouped AS (
  SELECT transfer_group_id,
         array_agg(id ORDER BY id) AS txn_ids,
         array_agg(account_id ORDER BY id) AS account_ids
  FROM transactions
  WHERE transfer_group_id IS NOT NULL AND deleted_at IS NULL
  GROUP BY transfer_group_id
  HAVING count(*) = 2
),
paired AS (
  SELECT transfer_group_id,
         txn_ids[1] AS txn1,
         txn_ids[2] AS txn2,
         account_ids[1] AS account1,
         account_ids[2] AS account2
  FROM grouped
)
UPDATE transactions t
SET is_transfer = true,
    transfer_to_account_id = CASE
      WHEN t.id = paired.txn1 THEN paired.account2
      WHEN t.id = paired.txn2 THEN paired.account1
      ELSE t.transfer_to_account_id
    END
FROM paired
WHERE t.id IN (paired.txn1, paired.txn2);

WITH invalid_groups AS (
  SELECT transfer_group_id
  FROM transactions
  WHERE transfer_group_id IS NOT NULL AND deleted_at IS NULL
  GROUP BY transfer_group_id
  HAVING count(*) <> 2
)
UPDATE transactions
SET transfer_group_id = NULL,
    is_transfer = false,
    transfer_to_account_id = NULL
WHERE transfer_group_id IN (SELECT transfer_group_id FROM invalid_groups);

ALTER TABLE transactions
  ALTER COLUMN bank_status SET DEFAULT 'posted',
  ALTER COLUMN reconciliation_status SET DEFAULT 'unreconciled';

CREATE INDEX IF NOT EXISTS idx_transactions_account_date
  ON transactions(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_status
  ON transactions(bank_status);
CREATE INDEX IF NOT EXISTS idx_transactions_reconciliation_status
  ON transactions(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group
  ON transactions(transfer_group_id)
  WHERE transfer_group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_source_hash_unique
  ON transactions(account_id, source, source_hash)
  WHERE source_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_reconciliation_state_chk'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_reconciliation_state_chk
      CHECK (
        (reconciliation_status = 'unreconciled' AND cleared_at IS NULL AND reconciled_at IS NULL)
        OR (reconciliation_status = 'cleared' AND cleared_at IS NOT NULL AND reconciled_at IS NULL)
        OR (reconciliation_status = 'reconciled' AND reconciled_at IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_transfer_group_chk'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_transfer_group_chk
      CHECK (transfer_group_id IS NULL OR is_transfer = true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION transactions_sync_canonical()
RETURNS trigger AS $$
DECLARE
  other_account uuid;
BEGIN
  IF NEW.bank_status IS NULL THEN
    IF NEW.status = 'PENDING' OR NEW.txn_status = 'draft' THEN
      NEW.bank_status := 'pending';
    ELSE
      NEW.bank_status := 'posted';
    END IF;
  END IF;

  IF NEW.review_status IS NULL THEN
    IF NEW.reviewed = true OR NEW.approved_at IS NOT NULL THEN
      NEW.review_status := 'approved';
    ELSE
      NEW.review_status := 'needs_review';
    END IF;
  END IF;

  NEW.reviewed := (NEW.review_status = 'approved');
  IF NEW.review_status = 'approved' AND NEW.approved_at IS NULL THEN
    NEW.approved_at := now();
  END IF;

  IF NEW.reconciliation_status IS NULL THEN
    IF NEW.reconciled_at IS NOT NULL THEN
      NEW.reconciliation_status := 'reconciled';
    ELSIF NEW.cleared_at IS NOT NULL THEN
      NEW.reconciliation_status := 'cleared';
    ELSE
      NEW.reconciliation_status := 'unreconciled';
    END IF;
  END IF;

  IF NEW.reconciliation_status = 'reconciled' THEN
    IF NEW.reconciled_at IS NULL THEN
      NEW.reconciled_at := now();
    END IF;
    NEW.cleared_at := COALESCE(NEW.cleared_at, NEW.reconciled_at);
  ELSIF NEW.reconciliation_status = 'cleared' THEN
    IF NEW.cleared_at IS NULL THEN
      NEW.cleared_at := now();
    END IF;
    NEW.reconciled_at := NULL;
  ELSE
    NEW.cleared_at := NULL;
    NEW.reconciled_at := NULL;
  END IF;

  IF NEW.voided_at IS NOT NULL THEN
    NEW.status := 'CANCELLED';
    NEW.txn_status := 'void';
  ELSE
    NEW.txn_status := CASE WHEN NEW.bank_status = 'pending' THEN 'draft' ELSE 'posted' END;
    NEW.status := CASE
      WHEN NEW.bank_status = 'pending' THEN 'PENDING'
      WHEN NEW.review_status = 'approved' THEN 'APPROVED'
      ELSE 'SETTLED'
    END;
  END IF;

  IF NEW.transfer_group_id IS NULL THEN
    NEW.is_transfer := false;
    NEW.transfer_to_account_id := NULL;
  ELSE
    NEW.is_transfer := true;
    IF NEW.transfer_to_account_id IS NULL THEN
      SELECT account_id
      INTO other_account
      FROM transactions
      WHERE transfer_group_id = NEW.transfer_group_id
        AND id <> NEW.id
        AND deleted_at IS NULL
      LIMIT 1;
      IF other_account IS NOT NULL THEN
        NEW.transfer_to_account_id := other_account;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_sync_canonical_trg ON transactions;
CREATE TRIGGER transactions_sync_canonical_trg
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION transactions_sync_canonical();

CREATE OR REPLACE FUNCTION transactions_update_is_split()
RETURNS trigger AS $$
DECLARE
  txn_id uuid;
BEGIN
  txn_id := COALESCE(NEW.transaction_id, OLD.transaction_id);
  UPDATE transactions
  SET is_split = EXISTS (
    SELECT 1 FROM transaction_splits WHERE transaction_id = txn_id
  )
  WHERE id = txn_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_update_is_split_trg ON transaction_splits;
CREATE TRIGGER transactions_update_is_split_trg
AFTER INSERT OR DELETE OR UPDATE OF transaction_id ON transaction_splits
FOR EACH ROW
EXECUTE FUNCTION transactions_update_is_split();

CREATE OR REPLACE FUNCTION transactions_validate_split_total()
RETURNS trigger AS $$
DECLARE
  txn_id uuid;
  total_amount numeric(12,2);
  header_amount numeric(12,2);
BEGIN
  txn_id := COALESCE(NEW.transaction_id, OLD.transaction_id);
  SELECT amount INTO header_amount FROM transactions WHERE id = txn_id;
  IF header_amount IS NULL THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM transaction_splits WHERE transaction_id = txn_id) THEN
    SELECT COALESCE(SUM(amount), 0)::numeric(12,2)
      INTO total_amount
    FROM transaction_splits
    WHERE transaction_id = txn_id;
    IF total_amount <> header_amount THEN
      RAISE EXCEPTION 'Split total % does not match transaction amount % for transaction %',
        total_amount, header_amount, txn_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION transactions_validate_split_total_on_txn()
RETURNS trigger AS $$
DECLARE
  total_amount numeric(12,2);
BEGIN
  IF EXISTS (SELECT 1 FROM transaction_splits WHERE transaction_id = NEW.id) THEN
    SELECT COALESCE(SUM(amount), 0)::numeric(12,2)
      INTO total_amount
    FROM transaction_splits
    WHERE transaction_id = NEW.id;
    IF total_amount <> NEW.amount THEN
      RAISE EXCEPTION 'Split total % does not match transaction amount % for transaction %',
        total_amount, NEW.amount, NEW.id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transaction_splits_total_chk ON transaction_splits;
CREATE CONSTRAINT TRIGGER transaction_splits_total_chk
AFTER INSERT OR UPDATE OR DELETE ON transaction_splits
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION transactions_validate_split_total();

DROP TRIGGER IF EXISTS transactions_total_chk ON transactions;
CREATE CONSTRAINT TRIGGER transactions_total_chk
AFTER UPDATE OF amount ON transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION transactions_validate_split_total_on_txn();

CREATE OR REPLACE FUNCTION transactions_validate_transfer_group()
RETURNS trigger AS $$
DECLARE
  group_id uuid;
  txn_count integer;
  accounts uuid[];
  transfer_accounts uuid[];
BEGIN
  group_id := COALESCE(NEW.transfer_group_id, OLD.transfer_group_id);
  IF group_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*), array_agg(account_id), array_agg(transfer_to_account_id)
  INTO txn_count, accounts, transfer_accounts
  FROM transactions
  WHERE transfer_group_id = group_id
    AND deleted_at IS NULL;

  IF txn_count <> 2 THEN
    RAISE EXCEPTION 'Transfer group % must have exactly two active transactions', group_id;
  END IF;

  IF accounts[1] = accounts[2] THEN
    RAISE EXCEPTION 'Transfer group % must span distinct accounts', group_id;
  END IF;

  IF transfer_accounts[1] IS NULL OR transfer_accounts[2] IS NULL THEN
    RAISE EXCEPTION 'Transfer group % requires transfer_to_account_id on both sides', group_id;
  END IF;

  IF transfer_accounts[1] <> accounts[2] OR transfer_accounts[2] <> accounts[1] THEN
    RAISE EXCEPTION 'Transfer group % must link reciprocal accounts', group_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_transfer_group_chk ON transactions;
CREATE CONSTRAINT TRIGGER transactions_transfer_group_chk
AFTER INSERT OR UPDATE OR DELETE ON transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION transactions_validate_transfer_group();

CREATE OR REPLACE FUNCTION transactions_audit_state_changes()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
      INSERT INTO transaction_audit (transaction_id, field, old_value, new_value, changed_at, changed_by)
      VALUES (NEW.id, 'review_status', OLD.review_status::text, NEW.review_status::text, now(), NEW.updated_by);
    END IF;
    IF NEW.reconciliation_status IS DISTINCT FROM OLD.reconciliation_status THEN
      INSERT INTO transaction_audit (transaction_id, field, old_value, new_value, changed_at, changed_by)
      VALUES (NEW.id, 'reconciliation_status', OLD.reconciliation_status::text, NEW.reconciliation_status::text, now(), NEW.updated_by);
    END IF;
    IF NEW.bank_status IS DISTINCT FROM OLD.bank_status THEN
      INSERT INTO transaction_audit (transaction_id, field, old_value, new_value, changed_at, changed_by)
      VALUES (NEW.id, 'bank_status', OLD.bank_status::text, NEW.bank_status::text, now(), NEW.updated_by);
    END IF;
    IF NEW.voided_at IS DISTINCT FROM OLD.voided_at THEN
      INSERT INTO transaction_audit (transaction_id, field, old_value, new_value, changed_at, changed_by)
      VALUES (NEW.id, 'voided_at', OLD.voided_at::text, NEW.voided_at::text, now(), NEW.updated_by);
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      INSERT INTO transaction_audit (transaction_id, field, old_value, new_value, changed_at, changed_by)
      VALUES (NEW.id, 'deleted_at', OLD.deleted_at::text, NEW.deleted_at::text, now(), NEW.updated_by);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_audit_state_changes_trg ON transactions;
CREATE TRIGGER transactions_audit_state_changes_trg
AFTER UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION transactions_audit_state_changes();

CREATE OR REPLACE FUNCTION transactions_audit_splits()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO transaction_audit (transaction_id, split_id, field, action, before_json, after_json, changed_at, changed_by)
    VALUES (NEW.transaction_id, NEW.id, 'split', 'split_insert', NULL, to_jsonb(NEW), now(), NEW.updated_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO transaction_audit (transaction_id, split_id, field, action, before_json, after_json, changed_at, changed_by)
    VALUES (NEW.transaction_id, NEW.id, 'split', 'split_update', to_jsonb(OLD), to_jsonb(NEW), now(), NEW.updated_by);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO transaction_audit (transaction_id, split_id, field, action, before_json, after_json, changed_at, changed_by)
    VALUES (OLD.transaction_id, OLD.id, 'split', 'split_delete', to_jsonb(OLD), NULL, now(), OLD.updated_by);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_audit_splits_trg ON transaction_splits;
CREATE TRIGGER transactions_audit_splits_trg
AFTER INSERT OR UPDATE OR DELETE ON transaction_splits
FOR EACH ROW
EXECUTE FUNCTION transactions_audit_splits();

COMMIT;
