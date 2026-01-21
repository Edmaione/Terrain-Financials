# Project State - Landscape Finance

Last updated: 2026-01-21

## Feature Status

### Core Features - Complete
- [x] CSV upload and parsing (multi-format: Relay, Chase, BofA, Amex, US Bank, etc.)
- [x] Account management (CRUD, balance tracking)
- [x] Category management (hierarchical, matches QuickBooks structure)
- [x] Transaction listing with filters (date, account, category, status, search)
- [x] P&L Report generation
- [x] Cash flow visualization
- [x] AI-powered transaction categorization
- [x] Categorization rules (learn from approvals)
- [x] Bulk transaction operations (approve, categorize, delete)
- [x] Import job tracking with status
- [x] Account auto-detection from CSV headers
- [x] Duplicate detection (row hash based)

### Import Flow - Complete
- [x] Column mapping UI with preview
- [x] Date format auto-detection
- [x] Amount strategy (signed vs inflow/outflow)
- [x] Fast-path mode (skip mapping for known formats)
- [x] Import profiles (saved mappings per institution)
- [x] AI category suggestions in preview table
- [x] Category override before import (with learning)
- [x] Progress tracking during import
- [x] Error handling with row-level details

### AI Categorization - Complete
- [x] Rule-based matching (exact + pattern)
- [x] OpenAI GPT-4o-mini fallback
- [x] Confidence scoring
- [x] Learning from user corrections
- [x] Batch preview endpoint (`/api/categorization/preview-batch`)
- [x] Learn endpoint (`/api/categorization/learn`)
- [x] Rule penalty system (times_wrong tracking)

### Transaction Review - Complete
- [x] Needs review / approved status
- [x] Individual approval workflow
- [x] Bulk approval
- [x] Category reassignment with audit
- [x] Low confidence highlighting
- [x] Filter by review status

### Planned / Not Started
- [ ] Stripe webhook integration (auto-import payments)
- [ ] Gusto payroll import
- [ ] Receipt/PDF scanning
- [ ] Job costing (link transactions to jobs)
- [ ] Terrain CRM integration
- [ ] Multi-user support
- [ ] Export to accountant (CSV/PDF)

## Recent Changes (Jan 2026)

### UI/UX Improvements
- Enhanced import preview table with AI suggestions
- Category dropdown with confidence badges
- Immediate learning when user overrides category
- Fast-path mode shows categories in compact preview

### Code Quality (Diagnostic Scan)
- Fixed ESLint exhaustive-deps warnings
- Added conditional debug logging (DEBUG_CATEGORIZATION, DEBUG_AI)
- Improved JSON.parse error handling in OpenAI responses
- Removed dead code (unused functions/variables)
- Updated vitest to 2.1.9

### Import Flow Hardening
- Improved account detection confidence thresholds
- Better error handling for import failures
- Transaction status validation fixes

## Database Migrations Applied
1. `002_ledger_upgrade.sql` - Enhanced ledger structure
2. `003_csv_ingest_atomic.sql` - Atomic CSV import
3. `004_imports.sql` - Import tracking tables
4. `005_import_mappings.sql` - Saved column mappings
5. `006_import_hardening.sql` - Import error handling
6. `007_category_mappings.sql` - Category mapping table
7. `008_account_import_mappings.sql` - Account detection mappings
8. `009_transactions_hardening.sql` - Transaction audit fields
9. `010_drop_legacy_status_constraint.sql` - Status field cleanup

## Git State
- **Main branch**: `main` (production)
- **Dev branch**: `dev` (merged to main 2026-01-21)
- Recent commits:
  - `b6624ca` Update vitest to 2.1.9
  - `a8ace75` UI/UX improvements and AI categorization fixes
  - `40aff54` Code quality improvements from diagnostic scan

## Key Files Modified Recently
- `src/components/CSVUploader.tsx` - AI preview integration
- `src/components/ImportPreviewCategoryCell.tsx` - New component
- `src/lib/categorization-engine.ts` - Debug logging
- `src/lib/openai.ts` - Error handling improvements
- `src/components/TransactionsFilters.tsx` - useCallback fixes
