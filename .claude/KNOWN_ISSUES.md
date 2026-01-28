# Known Issues & Technical Debt

Last updated: 2026-01-27

## Active Issues

### PDF Statement Parsing — Amex Accuracy
- **Status**: Major improvements + workflow change, ready for testing
- **Problem**: 12-page Amex Business Prime statements had poor extraction accuracy, and PDF transactions weren't becoming DB transactions
- **Root causes**:
  1. Sending all 12 pages in one GPT-4o request caused context overload
  2. Sign convention mismatch between PDF and DB (payments showed negative on statement but need positive in DB)
  3. Unmatched PDF transactions weren't being created in DB
- **What was done (Jan 28)**:
  1. Added highly specific `AMEX_BUSINESS_PRIME_PROMPT` based on actual statement analysis
  2. Implemented **chunked processing**: metadata from page 1, transactions in 3-page chunks
  3. Added statement type auto-detection from first page
  4. **Fixed sign convention**: explicit instructions to flip signs (PDF negative payments → positive, PDF positive charges → negative)
  5. **New workflow**: Unmatched PDF transactions now CREATE new DB transactions (source='pdf_statement')
  6. All extracted transactions (matched + created) are auto-cleared for reconciliation
- **Expected results**: PDF upload now serves as both transaction import AND reconciliation in one step
- **Files**: `src/lib/openai.ts`, `src/lib/reconciliation.ts`, `src/app/api/statements/[id]/match-extracted/route.ts`
- **Debug**: Check server console for `[reconciliation]` logs showing matched/created counts

---

Last diagnostic scan: 2026-01-21

## Summary
Comprehensive diagnostic scan identified 65+ items across 6 categories.
Quick wins were fixed; remaining items documented here for future work.

---

## Security (18 findings)

### Acceptable for Local Tool
- No authentication middleware (single-user local app)
- No CSRF protection on API routes
- No rate limiting on endpoints

### Should Consider
- [ ] Input sanitization on payee/description fields (XSS prevention)
- [ ] Validate UUID formats on all ID parameters
- [ ] Add Content-Security-Policy headers
- [ ] Sanitize file names on upload

### Low Priority
- Environment variables accessed directly (no runtime validation)
- No audit logging for sensitive operations

---

## Error Handling (14 findings)

### Critical - Should Fix
- [ ] `import-runner.ts` - Catch errors in individual row processing to prevent batch failure
- [ ] `CSVUploader.tsx` - Handle network errors gracefully in AI suggestion fetch
- [ ] `categorization-engine.ts` - Better handling when Supabase query fails mid-batch

### Medium Priority
- [ ] Add retry logic for OpenAI API calls (transient failures)
- [ ] Better error messages for invalid CSV formats
- [ ] Handle Supabase connection timeouts

### Fixed
- [x] JSON.parse error handling in `openai.ts`

---

## Performance (12 findings)

### High Priority
- [ ] `TransactionTable.tsx` - Virtualization needed for 1000+ rows
- [ ] `CSVUploader.tsx` - Large file parsing blocks UI (consider web worker)

### Medium Priority
- [ ] Batch category lookups instead of N+1 queries in preview
- [ ] Memoize expensive computations in report generation
- [ ] Consider React.memo for table row components

### Low Priority
- Unused re-renders from context updates
- Large bundle size from recharts (consider lazy loading)

---

## API Validation (15 findings)

### Should Add Zod Validation
- [ ] `/api/transactions` - Validate bulk operation payloads
- [ ] `/api/imports` - Validate import configuration object
- [ ] `/api/categorization/learn` - Validate learning payload

### Type Coercion Issues
- [ ] Amount fields sometimes string, sometimes number
- [ ] Date fields inconsistent format (ISO vs locale)
- [ ] Boolean fields may come as strings from forms

### Fixed
- [x] Preview-batch endpoint validates transaction array

---

## Null/Undefined Handling (11 findings)

### Should Fix
- [ ] `reports.ts` - Handle missing category gracefully in P&L
- [ ] `TransactionTable.tsx` - Null check on optional category field
- [ ] `CSVUploader.tsx` - Handle undefined mapping fields

### Optional Chaining Opportunities
- Various places use `&&` chains instead of `?.`
- Some array operations don't handle empty arrays

---

## Dead Code (5 findings)

### Fixed
- [x] Removed unused `selectLowConfidence` function in TransactionTable.tsx
- [x] Removed unused `categorySection` variable in TransactionTable.tsx

### Remaining
- [ ] `TransactionFilters.tsx` (old) vs `TransactionsFilters.tsx` - possible duplicate
- [ ] Some unused type exports in `types/index.ts`
- [ ] Commented-out code blocks in various files

---

## Technical Debt Backlog

### Architecture
- [ ] Extract import logic from CSVUploader.tsx (76KB file, too large)
- [ ] Create shared hooks for common data fetching patterns
- [ ] Consolidate duplicate filter components

### Testing
- [ ] Add unit tests for categorization-engine.ts
- [ ] Add integration tests for import flow
- [ ] Add component tests for critical UI paths

### Documentation
- [ ] Document import profile format
- [ ] Document categorization rule matching algorithm
- [ ] Add JSDoc to public functions in lib/

---

## Environment Variables Required
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI (optional - AI features disabled without)
OPENAI_API_KEY=

# Debug flags (optional)
DEBUG_CATEGORIZATION=false
DEBUG_AI=false
DEBUG_DATA_FLOW=false
```

---

## How to Run Diagnostics
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build (catches SSR issues)
npm run build

# Tests
npm run test
```
