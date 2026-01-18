# Transactions QA Checklist

Use this checklist to validate the end-to-end transaction workflow after pulling the latest changes.

## Setup
- Confirm `.env.local` includes Supabase credentials and any required Next.js env vars.
- Seed sample data if needed.

## Import and mapping
1. Navigate to **Upload CSV**.
2. Select an account and upload a CSV with a category column and status column.
3. In **Field mapping**, map Date, Payee, Amount, Category, and Bank status columns.
4. Confirm the preview shows category labels from the CSV.
5. Click **Import transactions** and verify the import is queued.
6. Confirm the progress bar reflects processed rows and totals.

## Transactions list
1. Open **Transactions**.
2. Confirm results are paginated and only include non-deleted rows.
3. Verify columns render date, payee, memo, amount, category, and status badges.
4. Confirm status badges reflect `bank_status`, `reconciliation_status`, and any voided or deleted flags.

## Filters and search
1. Filter by account, bank status, reconciliation status, and review status.
2. Apply a category filter and confirm child categories are included.
3. Set amount min and max and verify results update.
4. Filter by source system and import ID.
5. Enter a payee or memo keyword in search and confirm AND logic with other filters.

## Review and categorization
1. Pick an unreviewed transaction.
2. Use **Approve** with a selected category and confirm review status updates.
3. Confirm the row highlight clears and category display is derived from the category table.

## Bulk operations
1. Select multiple transactions.
2. Run **Mark reviewed**, **Apply category**, and **Approve**.
3. Run **Mark cleared**, **Mark reconciled**, and **Mark unreconciled**.
4. Run **Soft delete** and confirm rows disappear.
5. Use **Restore** and confirm rows return.

## Transfers
1. Import or create two opposite-sign transactions on the same date in two different accounts.
2. Verify the system pairs them into a transfer group and both sides show `is_transfer = true`.
3. Confirm `transfer_to_account_id` is set on both sides.

## Reconciliation
1. Toggle reconciliation status through unreconciled, cleared, and reconciled.
2. Confirm `cleared_at` and `reconciled_at` are set or cleared appropriately.

## Audit trail
1. Perform bulk account updates and reconciliation changes.
2. Inspect `transaction_audit` and confirm field changes are logged with timestamps.

