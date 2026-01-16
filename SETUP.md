# Setup Instructions

Complete guide to deploying Landscape Finance to Vercel + Supabase.

## Prerequisites

- Node.js 18+ installed
- OpenAI API key (you already have this)
- Vercel account (free tier works)
- Supabase account (free tier works)

## Step 1: Set Up Supabase

1. **Create a new Supabase project:**
   - Go to https://supabase.com/dashboard
   - Click "New Project"
   - Name it "landscape-finance"
   - Choose a region close to you
   - Set a database password (save this!)

2. **Run the database schema:**
   - In Supabase dashboard, go to SQL Editor
   - Click "New Query"
   - Copy/paste the entire contents of `supabase-schema.sql`
   - Click "Run"
   - Verify it completes without errors (you should see all tables created)

3. **Get your Supabase credentials:**
   - Go to Project Settings > API
   - Copy these values:
     - `Project URL` → NEXT_PUBLIC_SUPABASE_URL
     - `anon public` key → NEXT_PUBLIC_SUPABASE_ANON_KEY
     - `service_role` key → SUPABASE_SERVICE_ROLE_KEY (keep secret!)

## Step 2: Set Up Local Development

1. **Install dependencies:**
   ```bash
   cd landscape-finance
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.local.example .env.local
   ```

3. **Fill in `.env.local` with your credentials:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=your-openai-api-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Start the dev server:**
   ```bash
   npm run dev
   ```

5. **Open http://localhost:3000** in your browser

## Step 3: Test Core Functionality

1. **Test CSV Upload:**
   - Navigate to Upload page
   - Try uploading the sample `Relay_2025-12-01__2013.csv`
   - Verify transactions are parsed correctly

2. **Test Categorization:**
   - Transactions should auto-categorize based on rules
   - Review and approve a few
   - Check that new rules are created

3. **Test Reports:**
   - Navigate to Reports
   - Generate a P&L for December 2024
   - Verify it matches your QuickBooks structure

## Step 4: Deploy to Vercel

1. **Push code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-github-repo-url
   git push -u origin main
   ```

2. **Connect to Vercel:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Add environment variables in Vercel:**
   - Go to Project Settings > Environment Variables
   - Add all the same variables from `.env.local`
   - Make sure to add them for Production, Preview, and Development

4. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete
   - Visit your live URL!

## Step 5: Import Historical Data

1. **Export from QuickBooks:**
   - Export your transactions as CSV (last 2 years)
   - Or use the QuickBooks P&L PDF you already have

2. **Upload to the system:**
   - Use the CSV Upload feature for transactions
   - System will categorize based on payee patterns
   - Review and approve categorizations
   - This creates rules for future transactions

## Step 6: Set Up Weekly Workflow

1. **Create a bookmark folder** with all your bank/CC login pages

2. **Every Monday morning** (or your preferred day):
   - Log into each account
   - Download CSV for last week's transactions
   - Drag all CSVs into the Upload page at once
   - Review AI categorizations (should take 2-5 min)
   - Check Weekly Summary dashboard

3. **Monthly:**
   - Review P&L report
   - Compare to prior month/year
   - Export for accountant if needed

## Optional: Set Up Stripe Integration

If you want automated Stripe payment syncing:

1. **Get Stripe API keys:**
   - Go to Stripe Dashboard > Developers > API Keys
   - Copy Secret Key
   - Add to environment variables

2. **Set up webhook:**
   - Create webhook endpoint: `/api/stripe/webhook`
   - Subscribe to `payment_intent.succeeded` events
   - System will auto-import payments

## Troubleshooting

### CSV Upload Fails
- Check CSV format matches expected columns
- Try using generic parser (system auto-detects)
- Check console for error messages

### Categorization Not Working
- Verify OpenAI API key is correct
- Check that categories were seeded properly in database
- Look at Network tab for API errors

### Database Connection Issues
- Verify Supabase URL and keys
- Check that RLS (Row Level Security) is disabled on tables
- Ensure service role key is used for admin operations

### Vercel Build Fails
- Check Node version (should be 18+)
- Verify all environment variables are set
- Check build logs for specific errors

## Next Steps

Once everything is working:

1. **Customize categories** to match your exact needs
2. **Set up Terrain CRM integration** (when ready)
3. **Configure Gusto import** workflow
4. **Add custom reports** you want to see

## Support

If you run into issues during setup:
1. Check the error messages carefully
2. Review this guide step-by-step
3. Check Supabase logs (Dashboard > Logs)
4. Check Vercel deployment logs
