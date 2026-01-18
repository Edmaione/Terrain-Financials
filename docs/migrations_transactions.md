# Migration Runbook: Transaction Hardening

## Migration Order

Run migrations in numeric order as committed. The new migration for this change set is:

1. `supabase/migrations/009_transactions_hardening.sql`

## Post-migration Validation Queries

### 1) No transaction has contradictory states
```sql
SELECT id
FROM transactions
WHERE (reconciliation_status = 'unreconciled' AND (cleared_at IS NOT NULL OR reconciled_at IS NOT NULL))
   OR (reconciliation_status = 'cleared' AND (cleared_at IS NULL OR reconciled_at IS NOT NULL))
   OR (reconciliation_status = 'reconciled' AND reconciled_at IS NULL);
```

### 2) All transfers are paired correctly
```sql
SELECT transfer_group_id,
       COUNT(*) AS txn_count,
       ARRAY_AGG(account_id) AS accounts,
       ARRAY_AGG(transfer_to_account_id) AS transfer_accounts
FROM transactions
WHERE transfer_group_id IS NOT NULL AND deleted_at IS NULL
GROUP BY transfer_group_id
HAVING COUNT(*) <> 2
    OR MIN(account_id) = MAX(account_id)
    OR ARRAY_AGG(transfer_to_account_id) IS NULL;
```

### 3) All split/line sums match header amounts
```sql
SELECT t.id,
       t.amount AS header_amount,
       SUM(s.amount) AS split_total
FROM transactions t
JOIN transaction_splits s ON s.transaction_id = t.id
GROUP BY t.id, t.amount
HAVING SUM(s.amount) <> t.amount;
```

### 4) No duplicate imports per idempotency key
```sql
SELECT account_id, source, source_hash, COUNT(*)
FROM transactions
WHERE source_hash IS NOT NULL
GROUP BY account_id, source, source_hash
HAVING COUNT(*) > 1;
```

### 5) Core indexes exist
```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_transactions_account_date',
    'idx_transactions_bank_status',
    'idx_transactions_reconciliation_status',
    'idx_transactions_transfer_group',
    'transactions_source_hash_unique'
  )
ORDER BY indexname;
```
