# Landscape Finance

A custom financial management system built specifically for Maione Landscapes LLC to replace QuickBooks with unlimited flexibility at near-zero cost.

## Overview

This system provides:
- ✅ CSV upload from any bank (weekly ~10 min workflow)
- ✅ AI-powered transaction categorization
- ✅ S-corp aware financial tracking
- ✅ P&L matching QuickBooks structure exactly
- ✅ Cash flow forecasting
- ✅ Stripe integration for customer payments
- ✅ Gusto payroll import
- ✅ Receipt/PDF scanning and extraction
- ✅ Simple job costing (optional)

## Tech Stack

- **Next.js 14** - React framework
- **Supabase** - PostgreSQL database + file storage
- **OpenAI** - AI categorization + PDF extraction
- **Vercel** - Hosting (free tier)

## Cost Estimate

- Supabase: **$0/month** (free tier)
- Vercel: **$0/month** (free tier)
- OpenAI API: **$10-20/month** (200 transactions + categorization)

**Total: ~$15/month** vs QuickBooks ~$60-100/month

## Quick Start

1. **Read PROJECT.md** - Complete system architecture and design decisions
2. **Read SETUP.md** - Step-by-step deployment guide
3. **Run the schema** - `supabase-schema.sql` in your Supabase project
4. **Deploy** - Follow SETUP.md to deploy to Vercel

## File Structure

```
landscape-finance/
├── PROJECT.md              # Complete architecture docs (READ FIRST for Claude Code)
├── SETUP.md                # Deployment instructions
├── DEVELOPMENT.md          # How to extend and customize
├── supabase-schema.sql     # Database schema (run in Supabase)
├── src/
│   ├── app/                # Next.js pages and API routes
│   ├── components/         # React components
│   ├── lib/                # Core business logic
│   │   ├── supabase.ts
│   │   ├── openai.ts
│   │   ├── csv-parser.ts
│   │   ├── categorization-engine.ts
│   │   └── reports.ts
│   └── types/              # TypeScript definitions
└── package.json
```

## Key Features

### 1. CSV Upload & Parsing
- Handles Relay, Chase, BofA, and generic CSV formats
- Auto-detects format and parses transactions
- Deduplication across multiple uploads
- Transfer detection

### 2. AI Categorization
- Pattern matching rules (GUSTO → Payroll categories)
- OpenAI suggestions with confidence scores
- Learns from user approvals
- Batch categorization for efficiency

### 3. Reports
- **P&L Report** - Matches QuickBooks structure exactly
- **Cash Flow** - Visual charts with forecasting
- **Weekly Summary** - Top expenses, unreviewed transactions
- All reports support custom date ranges

### 4. Integrations
- **Stripe** - Auto-import customer payments
- **Gusto** - Import payroll runs
- **Terrain CRM** - Link transactions to jobs (when ready)

## Chart of Accounts

Pre-configured with your exact QuickBooks categories:

**Income**
- Sales

**Cost of Goods Sold**
- LS COGS - Cost of Labor (wages, taxes, subcontractors, workers comp)
- LS COGS - Other Costs (disposal, fuel, merchant fees)
- LS COGS - Supplies & Materials (equipment, supplies, chemicals)

**Expenses**
- ADMIN (payroll, bank charges, legal, accounting)
- ADVERTISING & MARKETING
- OP FIXED (insurance, rent, software, utilities)
- OP VARIABLE (meals, repairs, taxes, travel)

**Other Income**
- Interest Income

## Weekly Workflow

1. **Monday morning** (10 minutes):
   - Download CSVs from all accounts (12-15 accounts)
   - Drag into Upload page
   - Review AI categorizations
   - Approve/correct
   - Done!

2. **Monthly** (15 minutes):
   - Review P&L vs prior periods
   - Check cash flow forecast
   - Export for accountant

## Development Status

**✅ Complete:**
- Database schema
- Type definitions
- CSV parser (multi-format)
- AI categorization engine
- Report generation (P&L, Cash Flow, Weekly)
- Core utilities (Supabase, OpenAI)

**⏳ To Build (in Claude Code):**
- UI components (React)
- API routes
- File upload handling
- Dashboard pages
- Integration with live data

## For Claude Code

When starting development:

1. **First, read PROJECT.md** - It has all context about design decisions, patterns detected, and architecture
2. Initialize Next.js: `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir`
3. Install dependencies: `npm install`
4. Copy environment variables from `.env.local.example` to `.env.local`
5. Start building UI components
6. Test with real CSV from `/uploads` directory

## License

Private - Maione Landscapes LLC

## Support

For questions or issues during setup, check:
1. SETUP.md troubleshooting section
2. Supabase logs
3. Vercel deployment logs
4. Browser console for frontend errors
