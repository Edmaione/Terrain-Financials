# Transaction Architecture (Canonical)

## Canonical Schema

### Transaction Header (`transactions`)
- **Tenant boundary:** `account_id` is the implicit tenant boundary in this schema.
- **Amount convention:** `amount` is **signed**. Positive values are inflows, negative values are outflows.
- **Lifecycle fields (canonical):**
  - `bank_status` (`pending` | `posted`)
  - `review_status` (`needs_review` | `approved`)
  - `reconciliation_status` (`unreconciled` | `cleared` | `reconciled`)
  - `voided_at` (nullable timestamp)
  - `deleted_at` (nullable timestamp)
- **Provenance:** `source`, `source_id`, `source_hash`, `import_id`, `import_row_number`, `import_row_hash`, `raw_csv_data`, `payee_original`, `payee_display`.

### Transaction Lines (`transaction_splits`)
- Line rows are **authoritative** when they exist.
- `amount` is signed (same convention as header).
- Allocation dimensions supported today:
  - `category_id` (required for allocations)
  - `job_id` (optional)
  - `payee_id` (optional)
- `line_number` is used to preserve ordering.

## Lifecycle State Machine

Canonical lifecycle is governed by:

1. **Bank status** (`pending` | `posted`)
2. **Review status** (`needs_review` | `approved`)
3. **Reconciliation status** (`unreconciled` | `cleared` | `reconciled`)
4. **Voided/Deleted** (`voided_at`, `deleted_at`)

Legacy fields (`status`, `txn_status`, `reviewed`, `approved_at`) are derived automatically via triggers for compatibility.

## Invariants (Must Always Be True)

1. **Split totals**: if a transaction has any split rows, the header amount equals the sum of split amounts.
2. **Transfers**: `transfer_group_id` links **exactly two** non-deleted transactions in different accounts, and each row’s `transfer_to_account_id` must point to the opposite account.
3. **Reconciliation state**:
   - `unreconciled` → `cleared_at` and `reconciled_at` are NULL.
   - `cleared` → `cleared_at` is set and `reconciled_at` is NULL.
   - `reconciled` → `reconciled_at` is set (and `cleared_at` is set automatically).
4. **Soft deletion**: `deleted_at` is the only supported mechanism for soft delete.
5. **Voiding**: `voided_at` means the transaction is void and legacy statuses move to `CANCELLED`/`void`.

## Imports & Provenance

Imported transactions retain:
- `source`, `source_id`, `source_hash`
- `import_id`, `import_row_number`, `import_row_hash`
- Raw text/CSV data (`raw_csv_data`, `payee_original`, `payee_display`)

Idempotency is enforced by the unique key `(account_id, source, source_hash)` when `source_hash` is present, plus `(import_id, import_row_hash)`.

### Application usage notes

- Import mapping stores **category labels** only for lookup. The app resolves those labels to canonical `category_id` values via `category_mappings` or a name match before inserting transactions.
- All UI and APIs read/write canonical lifecycle fields (`bank_status`, `review_status`, `reconciliation_status`) and never rely on legacy `status` or free-text category labels.
- Bulk operations update canonical fields and write audit entries into `transaction_audit`.

## Transfers

Transfers are represented using **`transfer_group_id`** across two transaction headers. Each side must:
- Reference the opposite account via `transfer_to_account_id`
- Be flagged as `is_transfer = true`

This is enforced via constraint triggers.

## Reconciliation

Reconciliation is driven by `reconciliation_status` plus timestamp fields:
- `cleared_at`
- `reconciled_at`

Automatic triggers keep the timestamps consistent with the selected status.

## RLS / Security

No Supabase RLS policies are defined for transactions or related tables in this repo. The current security posture is unchanged by the migration.
