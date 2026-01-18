import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { generateWeeklySummary } from '@/lib/reports'
import WeeklySummary from '@/components/WeeklySummary'
import DashboardStats from '@/components/DashboardStats'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import { Card } from '@/components/ui/Card'
import { buttonVariants } from '@/components/ui/Button'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  const debugIngest = process.env.INGEST_DEBUG === 'true'
  try {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 7)

    const weeklySummary = await generateWeeklySummary(
      weekStart.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    )

    const { count: unreviewedCount, error: unreviewedError } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('review_status', 'needs_review')
      .is('deleted_at', null)

    if (unreviewedError) {
      console.error('[dashboard] Failed to fetch unreviewed count', unreviewedError)
    }

    const { count: transactionCount, error: transactionCountError } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    if (transactionCountError) {
      console.error('[dashboard] Failed to fetch transaction count', transactionCountError)
    }

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const { data: monthTransactions, error: monthError } = await supabaseAdmin
      .from('transactions')
      .select('amount, category:categories!category_id(type)')
      .gte('date', monthStart.toISOString().split('T')[0])
      .is('deleted_at', null)

    if (monthError) {
      console.error('[dashboard] Failed to fetch monthly transactions', monthError)
    }

    let monthlyRevenue = 0
    let monthlyExpenses = 0

    monthTransactions?.forEach((t) => {
      if (t.amount > 0) {
        monthlyRevenue += t.amount
      } else {
        monthlyExpenses += Math.abs(t.amount)
      }
    })

    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('current_balance')
      .eq('is_active', true)

    if (accountsError) {
      console.error('[dashboard] Failed to fetch accounts', accountsError)
    }

    const currentCash = accounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) || 0

    if (debugIngest) {
      console.info('[ingest] Dashboard data fetched', {
        unreviewedCount: unreviewedCount || 0,
        monthTransactions: monthTransactions?.length || 0,
        activeAccounts: accounts?.length || 0,
      })
    }

    return {
      weeklySummary,
      unreviewedCount: unreviewedCount || 0,
      transactionCount: transactionCount || 0,
      monthlyRevenue,
      monthlyExpenses,
      monthlyProfit: monthlyRevenue - monthlyExpenses,
      currentCash,
      error: null,
    }
  } catch (error) {
    console.error('[dashboard] Failed to fetch dashboard data', error)
    return {
      weeklySummary: {
        week_start: '',
        week_end: '',
        total_income: 0,
        total_expenses: 0,
        net_change: 0,
        transaction_count: 0,
        unreviewed_count: 0,
        top_expenses: [],
      },
      unreviewedCount: 0,
      transactionCount: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      monthlyProfit: 0,
      currentCash: 0,
      error: error instanceof Error ? error.message : 'Failed to load dashboard data',
    }
  }
}

export default async function Dashboard() {
  const data = await getDashboardData()

  return (
    <div className="space-y-5">
      <PageHeader
        label="Dashboard"
        title="Maione Landscapes LLC"
        description="Financial overview with current cash, monthly performance, and review queue."
        actions={(
          <>
            <Link href="/transactions" className={buttonVariants({ variant: 'primary' })}>
              Review transactions
            </Link>
            <Link href="/upload" className={buttonVariants({ variant: 'secondary' })}>
              Upload CSV
            </Link>
            <Link href="/reports" className={buttonVariants({ variant: 'ghost' })}>
              View reports
            </Link>
          </>
        )}
      />

      {data.error && (
        <AlertBanner
          variant="error"
          title="Dashboard data is unavailable."
          message={data.error}
          actions={(
            <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
              Retry loading
            </Link>
          )}
        />
      )}

      {data.transactionCount === 0 ? (
        <Card className="border-dashed border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">No transactions yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Upload your first CSV file to start reviewing and categorizing transactions.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/upload" className={buttonVariants({ variant: 'primary' })}>
              Upload CSV
            </Link>
            <Link href="/transactions" className={buttonVariants({ variant: 'secondary' })}>
              View transactions
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <DashboardStats
            currentCash={data.currentCash}
            monthlyRevenue={data.monthlyRevenue}
            monthlyExpenses={data.monthlyExpenses}
            monthlyProfit={data.monthlyProfit}
            unreviewedCount={data.unreviewedCount}
          />

          <WeeklySummary summary={data.weeklySummary} />
        </>
      )}

      {data.unreviewedCount > 0 && (
        <Card className="border-l-4 border-amber-400 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              ⚠️
            </div>
            <div>
              <h3 className="text-sm font-medium text-amber-900">
                {data.unreviewedCount} transaction{data.unreviewedCount !== 1 ? 's' : ''} need review
              </h3>
              <div className="mt-2">
                <Link
                  href="/transactions?review_status=needs_review"
                  className="text-sm font-medium text-amber-700 hover:text-amber-600"
                >
                  Review now
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
