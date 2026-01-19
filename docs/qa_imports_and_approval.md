# QA Checklist: Imports & Approval

## Approval workflow
- [ ] Open a transaction and approve it.
  - Confirm `review_status` becomes `approved`.
  - Confirm `approved_at` and `approved_by` are populated.
  - Confirm `transactions.status` remains unchanged.

## CSV import status normalization
- [ ] Import a CSV with a Status column containing values like `complete`, `completed`, `pending`,
  and an unknown status.
  - Confirm posted/pending values normalize to `bank_status`.
  - Confirm unknown status values do **not** crash the import and appear as row issues.

## Import row issues visibility
- [ ] Complete an import with at least one row issue.
  - Confirm the upload page shows an issues summary (failed rows + top errors).
  - Confirm the "Download row issues" link returns a CSV of issues.
