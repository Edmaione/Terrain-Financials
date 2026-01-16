# CLAUDE CODE QUICK START

**Goal**: Complete the UI and deploy working V1

## What's Already Built (✅ Complete)

All core business logic is written and ready:

✅ Database schema (`supabase-schema.sql`)
✅ TypeScript types (`src/types/index.ts`)  
✅ Supabase client (`src/lib/supabase.ts`)
✅ OpenAI integration (`src/lib/openai.ts`)
✅ CSV parser - handles Relay + generic formats (`src/lib/csv-parser.ts`)
✅ AI categorization engine (`src/lib/categorization-engine.ts`)
✅ Report generation - P&L, Cash Flow, Weekly (`src/lib/reports.ts`)
✅ Package.json with all dependencies
✅ Tailwind + TypeScript config
✅ Complete documentation (PROJECT.md, SETUP.md, README.md)

## What Needs Building (⏳ Your Job)

The UI components and glue code:

### Phase 1: Foundation (30 min)
- [ ] Initialize Next.js app (or verify structure)
- [ ] Set up basic layout with navigation
- [ ] Create global styles
- [ ] Test Supabase connection

### Phase 2: Upload Flow (1 hour)
- [ ] CSV upload component
- [ ] File drop zone
- [ ] Transaction preview table
- [ ] Categorization review interface
- [ ] API route: `/api/upload/csv`

### Phase 3: Dashboard (1 hour)
- [ ] Weekly summary card
- [ ] Quick stats (cash, revenue, expenses)
- [ ] Recent transactions table
- [ ] Unreviewed transactions alert

### Phase 4: Reports (1 hour)
- [ ] P&L report component with date picker
- [ ] Cash flow chart (use recharts)
- [ ] Export to CSV functionality
- [ ] API routes: `/api/reports/pl`, `/api/reports/cashflow`

### Phase 5: Transaction Management (45 min)
- [ ] Transaction list view
- [ ] Filters (date, category, reviewed status)
- [ ] Bulk categorization actions
- [ ] Edit transaction modal

### Phase 6: Polish & Deploy (30 min)
- [ ] Error handling
- [ ] Loading states
- [ ] Responsive design check
- [ ] Deploy to Vercel

## Critical Files to Create

```
src/app/
├── layout.tsx              # Root layout with nav
├── page.tsx                # Dashboard (weekly summary)
├── upload/
│   └── page.tsx            # CSV upload interface
├── transactions/
│   └── page.tsx            # Transaction list & management
├── reports/
│   └── page.tsx            # P&L and cash flow
└── api/
    ├── upload/
    │   └── csv/route.ts    # Handle CSV upload
    ├── transactions/
    │   └── route.ts        # CRUD operations
    └── reports/
        ├── pl/route.ts     # Generate P&L
        └── cashflow/route.ts

src/components/
├── Navigation.tsx          # Top nav bar
├── CSVUploader.tsx         # Drag-drop CSV upload
├── TransactionTable.tsx    # Reusable table
├── CategorySelector.tsx    # Dropdown for categories
├── PLReport.tsx            # P&L display component
├── CashFlowChart.tsx       # Recharts visualization
└── WeeklySummary.tsx       # Dashboard widget
```

## Quick Commands

### Initial Setup
```bash
cd landscape-finance
npm install
cp .env.local.example .env.local
# Edit .env.local with credentials
npm run dev
```

### Testing
```bash
# Upload the sample CSV
# It's in the repo root: Relay_2025-12-01__2013.csv
# Navigate to http://localhost:3000/upload
# Drag and drop the CSV
# Verify it parses correctly
```

### Deploy
```bash
git add .
git commit -m "Complete UI"
git push
# Then deploy via Vercel dashboard
```

## Data You Have Access To

- `Relay_2025-12-01__2013.csv` - Real transaction data
- `P_L_2024.pdf` - QuickBooks P&L structure to match

## Key Design Patterns

### Server Actions (Preferred)
```typescript
// Use Next.js server actions for mutations
'use server'
export async function uploadCSV(formData: FormData) {
  // Parse CSV
  // Save to Supabase
  // Categorize
  // Return results
}
```

### Client Components
```typescript
'use client'
// Only for interactive UI
// Fetch data via server actions or API routes
```

## Testing Checklist

- [ ] Upload CSV → transactions imported
- [ ] Auto-categorization works
- [ ] Can review/approve categories
- [ ] P&L report generates
- [ ] Cash flow chart displays
- [ ] Weekly summary shows correctly
- [ ] Can edit transaction
- [ ] Deduplication works (upload same CSV twice)

## Known Gotchas

1. **Supabase**: Make sure RLS is disabled on tables (we're using service role)
2. **OpenAI**: Requests can be slow, show loading states
3. **CSV Parsing**: Handle various encodings, test with real bank CSVs
4. **Date Handling**: Use `date-fns` for consistent formatting
5. **Decimals**: Always use 2 decimal places for money

## Success Criteria

User can:
1. ✅ Upload weekly CSVs in < 5 minutes
2. ✅ Review/approve categorizations
3. ✅ See accurate P&L matching QuickBooks
4. ✅ View cash flow chart
5. ✅ Check weekly summary

## Time Estimate

**Total**: 4-5 hours of focused Claude Code time

- Phase 1: 30 min
- Phase 2: 1 hour
- Phase 3: 1 hour  
- Phase 4: 1 hour
- Phase 5: 45 min
- Phase 6: 30 min
- Buffer: 15 min

## Questions to Answer First

Before starting, verify:
- [ ] Supabase project created and schema run?
- [ ] Environment variables configured?
- [ ] OpenAI API key ready?
- [ ] Ready to test with real CSV?

## When You Get Stuck

1. Check PROJECT.md for context
2. Look at existing lib files for patterns
3. Check Supabase logs for database errors
4. Check browser console for client errors
5. Verify environment variables are set

**Good luck! The hard part (business logic) is done. You're just building the UI now.**
