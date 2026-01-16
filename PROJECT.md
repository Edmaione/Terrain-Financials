# Landscape Finance - QuickBooks Replacement

## Project Overview
A custom financial management system built specifically for Maione Landscapes LLC to replace QuickBooks with unlimited flexibility at near-zero cost.

**Business Context:**
- Small landscaping business (S-corp)
- ~200 transactions/month across 12-15 accounts
- Primarily maintenance work (not complex job costing)
- Using Stripe for payments, Gusto for payroll
- Building custom CRM called "Terrain"

## Tech Stack
- **Frontend/Backend:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (receipts, PDFs)
- **AI:** OpenAI API (user already has account)
- **Deployment:** Vercel
- **Cost:** $10-20/month (just OpenAI API usage)

## Core Architecture

### Data Flow
1. **Ingestion:** Weekly CSV uploads from 12-15 bank/CC accounts + Stripe API + Gusto exports
2. **Processing:** OpenAI extracts/categorizes transactions, learns patterns
3. **Storage:** Normalized in Supabase with rich metadata
4. **Presentation:** Dynamic dashboards (P&L, Cash Flow, Weekly Summary)

### Key Features
- CSV parser (handles Relay bank format + generic banks)
- PDF extraction (receipts, statements, invoices)
- AI categorization engine (learns vendor patterns)
- Auto-detect Gusto payroll, recurring expenses
- S-corp specific tax tracking
- Stripe integration for customer payments
- Simple job/customer tracking (optional)
- Real-time P&L matching QuickBooks structure
- Cash flow forecasting

## Chart of Accounts (from existing QuickBooks P&L)

### Income
- Sales

### Cost of Goods Sold
**LS COGS - Cost of Labor:**
- LS Technician Payroll taxes
- LS Technician Subcontractors
- LS Technician Wages
- LS Workers Compensation

**LS COGS - Other Costs:**
- LS Disposal Fees
- LS Fuel, Parking, Tolls
- LS Merchant Fees

**LS COGS - Supplies & Materials:**
- LS Equipment Rental
- LS Other Miscellaneous
- LS Supplies & Chemicals

### Expenses
**ADMIN:**
- Admin Payroll Taxes
- Owner Salary
- Payroll Expenses & Fees
- Virtual Assistant
- Bank Charges
- IRA/401K Benefits
- Accounting Services
- Business Consulting

**ADVERTISING & MARKETING:**
- Charitable Donation
- Marketing Ad Spend & Awareness
- Marketing Software & Website

**OP FIXED:**
- Dues & Subscriptions
- Insurance - Liability & Auto
- Interest Expense
- Rent & Lease
- Software Expense
- Utilities, Phone, Internet

**OP VARIABLE:**
- Education, Events, & Leadership Development
- Meals & Entertainment
- Recruiting
- Repairs & Maintenance - Auto
- Repairs & Maintenance - Tools
- Taxes, Licenses, Penalties, Permits
- Travel Meals

### Other
- Interest Income

## Database Schema

### accounts
- id (uuid)
- name (text) - "Relay Checking", "Chase CC", etc.
- account_number (text) - last 4 digits
- type (enum) - checking, credit_card, loan, savings
- institution (text) - "Relay", "Chase", etc.
- is_active (boolean)
- opening_balance (decimal)
- created_at, updated_at

### transactions
- id (uuid)
- account_id (fk to accounts)
- date (date)
- payee (text)
- description (text)
- amount (decimal) - negative for expenses, positive for income
- category_id (fk to categories)
- subcategory_id (fk to categories, nullable)
- job_id (fk to jobs, nullable)
- is_transfer (boolean) - internal transfers between accounts
- transfer_to_account_id (fk to accounts, nullable)
- payment_method (text) - "ACH", "Check", "Card", etc.
- reference (text) - check number, invoice number, etc.
- status (text) - "SETTLED", "PENDING", "CANCELLED"
- receipt_url (text) - link to Supabase storage
- notes (text)
- ai_suggested_category (text) - for review
- ai_confidence (decimal) - 0-1 score
- reviewed (boolean) - user has approved categorization
- created_at, updated_at
- raw_csv_data (jsonb) - original CSV row for reference

### categories
- id (uuid)
- name (text) - "LS Technician Wages"
- parent_id (fk to categories, nullable) - for subcategories
- type (enum) - income, cogs, expense, other_income, other_expense
- section (text) - "ADMIN", "OP FIXED", etc.
- is_tax_deductible (boolean)
- qb_equivalent (text) - maps to QuickBooks category name
- created_at, updated_at

### jobs (simple customer/project tracking)
- id (uuid)
- customer_name (text)
- job_name (text)
- terrain_id (text, nullable) - links to CRM
- status (enum) - active, completed, cancelled
- quoted_amount (decimal, nullable)
- created_at, updated_at

### categorization_rules
- id (uuid)
- payee_pattern (text) - regex or exact match
- description_pattern (text, nullable)
- category_id (fk to categories)
- confidence (decimal) - how confident in this rule
- times_applied (integer) - usage count
- last_used (timestamp)
- created_by (text) - "ai" or "user"

### payroll_entries
- id (uuid)
- gusto_id (text)
- pay_period_start (date)
- pay_period_end (date)
- pay_date (date)
- gross_wages (decimal)
- payroll_taxes (decimal)
- net_pay (decimal)
- worker_comp (decimal)
- employee_name (text, nullable)
- imported_at (timestamp)

## CSV Format (Relay Bank Example)
```
Date,Payee,Account #,Transaction Type,Description,Reference,Status,Amount,Currency,Balance
12/31/2025,GUSTO,,Spend,,"TAX 646296",SETTLED,-154.69,USD,1163.45
```

**Key patterns to detect:**
- GUSTO transactions → auto-categorize to payroll
- NEXT INSUR → Insurance
- WISE US INC → (need to determine)
- T-MOBILE → Utilities
- Transfers (Account # present) → mark as internal transfer

## Workflow

### Weekly (10 minutes)
1. User downloads CSVs from 12-15 accounts
2. Drags into upload interface
3. System parses, deduplicates, AI categorizes
4. User reviews/approves in batch
5. Done

### Monthly
1. Review P&L vs prior month/year
2. Check cash flow forecast
3. Export for accountant

### Tax Time
1. One-click S-corp reports
2. Category summaries
3. Receipt vault access

## AI Categorization Logic

### Rules Engine
1. Check exact payee match in categorization_rules
2. Check regex patterns
3. If no match, use OpenAI to suggest category based on:
   - Payee name
   - Description
   - Amount patterns
   - Historical similar transactions
4. Return suggestion + confidence score
5. User approves → create new rule for future

### Smart Patterns
- "GUSTO" + "TAX" → LS Technician Payroll taxes
- "GUSTO" + "NET" → LS Technician Wages
- "GUSTO" + "FEE" → Payroll Expenses & Fees
- Transfer descriptions → mark as internal transfer
- Recurring amounts/payees → auto-categorize

## File Structure
```
landscape-finance/
├── README.md
├── PROJECT.md (this file)
├── SETUP.md (deployment instructions)
├── DEVELOPMENT.md (how to extend)
├── package.json
├── next.config.js
├── tsconfig.json
├── .env.local.example
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql (sample data for testing)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx (dashboard)
│   │   ├── transactions/
│   │   ├── upload/
│   │   ├── reports/
│   │   └── api/
│   ├── components/
│   │   ├── CSVUploader.tsx
│   │   ├── PDFUploader.tsx
│   │   ├── TransactionReview.tsx
│   │   ├── PLReport.tsx
│   │   ├── CashFlowChart.tsx
│   │   └── WeeklySummary.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── openai.ts
│   │   ├── csv-parser.ts
│   │   ├── pdf-extractor.ts
│   │   ├── categorization-engine.ts
│   │   └── reports.ts
│   └── types/
│       └── index.ts
└── public/
```

## Next Steps for Claude Code
1. Initialize Next.js project
2. Set up Supabase connection
3. Run database migrations
4. Test CSV upload with real Relay CSV
5. Test PDF extraction
6. Deploy to Vercel
7. Connect to production Supabase

## Known Vendor Patterns (from sample CSV)
- GUSTO → Payroll (multiple sub-categories)
- NEXT INSUR → Insurance
- WISE US INC → (TBD - appears weekly)
- T-MOBILE → Utilities
- HANOVER INS → Insurance
- Transfers have Account # present

## Design Decisions
- **No job costing complexity:** Business is primarily maintenance, not project-based
- **Weekly CSV uploads:** More reliable and free vs API integrations
- **AI learns patterns:** Reduces manual categorization over time
- **S-corp aware:** Tracks owner salary separately, payroll taxes properly
- **QuickBooks compatibility:** Categories match existing P&L for easy comparison
