# Landscape Finance - Claude Code Context

> **SESSION STARTUP**: Read `.claude/PROJECT_STATE.md` and `.claude/KNOWN_ISSUES.md` before starting work.

## Session Protocol

### On Session Start
1. Read `.claude/PROJECT_STATE.md` for current feature status and recent changes
2. Read `.claude/KNOWN_ISSUES.md` for known bugs and technical debt
3. Check `git status` and `git log --oneline -5` for recent work

### During Session
- Use TodoWrite to track tasks as you work
- Update `.claude/PROJECT_STATE.md` when completing features or making significant changes
- Update `.claude/KNOWN_ISSUES.md` when finding or fixing issues

### On Session End (or when asked to wrap up)
1. Update `.claude/PROJECT_STATE.md`:
   - Mark completed features as done
   - Add any new in-progress work
   - Update "Recent Changes" section with what was done
   - Update "Git State" with latest commits
2. Update `.claude/KNOWN_ISSUES.md`:
   - Mark fixed issues as [x]
   - Add any new issues discovered
3. Commit context file updates if other changes were committed

---

Custom financial management system for Maione Landscapes LLC (S-corp). Replaces QuickBooks with unlimited flexibility at ~$15/month.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Supabase (PostgreSQL + RLS)
- **AI**: OpenAI GPT-4o-mini for categorization, GPT-4o for PDF extraction
- **Hosting**: Vercel (free tier)

## Commands
```bash
npm run dev        # Start development server
npm run build      # Production build
npm run type-check # TypeScript validation
npm run lint       # ESLint
npm run test       # Vitest tests
```

## Key Architecture

### File Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── accounts/      # Account CRUD
│   │   ├── categories/    # Category management
│   │   ├── categorization/# AI categorization endpoints
│   │   ├── imports/       # Import management
│   │   ├── transactions/  # Transaction CRUD & bulk ops
│   │   └── upload/        # File upload handling
│   ├── accounts/          # Account management page
│   ├── categories/        # Category management page
│   ├── reports/           # P&L, Cash Flow reports
│   ├── transactions/      # Transaction list/review
│   └── upload/            # CSV upload page
├── components/            # React components
├── lib/                   # Core business logic
│   ├── categorization-engine.ts  # Rule matching + AI fallback
│   ├── csv-importer.ts           # CSV processing pipeline
│   ├── import-runner.ts          # Async import orchestration
│   ├── openai.ts                 # OpenAI API wrapper
│   └── reports.ts                # P&L generation
└── types/index.ts         # All TypeScript interfaces
```

### Data Flow: CSV Import
1. Upload CSV -> `CSVUploader.tsx` parses with PapaParse
2. Column mapping -> `ImportFieldMapping` type
3. Account detection -> `account-detection.ts` (header fingerprinting)
4. Preview with AI suggestions -> `/api/categorization/preview-batch`
5. Execute import -> `/api/imports` creates ImportRecord
6. Process rows -> `import-runner.ts` handles async processing
7. AI categorization -> `categorization-engine.ts` (rules first, then OpenAI)

### Categorization Engine Priority
1. **Exact rule match** - `categorization_rules` table, normalized payee
2. **Pattern rule match** - Partial string matching
3. **AI suggestion** - GPT-4o-mini with business context
4. Returns: `{ category_id, confidence, rule_id?, source }`

### Key Types (src/types/index.ts)
- `Transaction` - Core transaction with all audit fields
- `Category` - Chart of accounts with sections (Income, COGS, Expense)
- `Account` - Bank/credit card accounts
- `ImportRecord` - Import job tracking
- `CategorizationRule` - Learned categorization patterns

### Database Tables (Supabase)
- `transactions` - All transactions with soft delete
- `categories` - Chart of accounts (matches QuickBooks structure)
- `accounts` - Bank accounts
- `categorization_rules` - AI learning from approvals
- `imports` - Import job records
- `import_profiles` - Saved column mappings per institution

## Development Patterns

### API Routes
- Use `supabaseAdmin` for server-side DB access (bypasses RLS)
- Return `{ ok: boolean, data?, error? }` pattern
- Validate with Zod where complex input

### Components
- Use `apiRequest()` from `lib/api-client.ts` for fetch calls
- Toast notifications via custom toast context
- Mantine-inspired UI components in `components/ui/`

### Debug Flags
```env
DEBUG_CATEGORIZATION=true  # Log categorization decisions
DEBUG_AI=true              # Log OpenAI API calls
DEBUG_DATA_FLOW=true       # Log component data flow
```

## Business Context
- Landscaping company with 12-15 bank accounts
- Weekly workflow: Download CSVs, upload, review AI suggestions, approve
- Categories match QuickBooks structure for accountant compatibility
- S-corp structure: Owner pay, distributions tracked separately

## See Also
- `.claude/PROJECT_STATE.md` - Current feature status
- `.claude/KNOWN_ISSUES.md` - Technical debt and diagnostics
- `README.md` - Setup instructions
