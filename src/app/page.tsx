import { supabaseAdmin } from '@/lib/supabase'
import { generateWeeklySummary } from '@/lib/reports'
import WeeklySummary from '@/components/WeeklySummary'
import DashboardStats from '@/components/DashboardStats'
import PageHeader from '@/components/PageHeader'

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
      .eq('reviewed', false)

    if (unreviewedError) {
      console.error('[dashboard] Failed to fetch unreviewed count', unreviewedError)
    }

    const { count: transactionCount, error: transactionCountError } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })

    if (transactionCountError) {
      console.error('[dashboard] Failed to fetch transaction count', transactionCountError)
    }

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const { data: monthTransactions, error: monthError } = await supabaseAdmin
      .from('transactions')
      .select('amount, category:categories!category_id(type)')
      .gte('date', monthStart.toISOString().split('T')[0])

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Financial overview for Maione Landscapes LLC."
        actions={(
          <>
            <a href="/transactions" className="btn-primary">
              Review transactions
            </a>
            <a href="/upload" className="btn-secondary">
              Upload CSV
            </a>
            <a href="/reports" className="btn-ghost">
              View reports
            </a>
          </>
        )}
      />

      {data.error && (
        <div className="card border border-rose-200 bg-rose-50 text-rose-900">
          <h2 className="text-sm font-semibold">Dashboard data is unavailable.</h2>
          <p className="text-sm text-rose-700 mt-1">{data.error}</p>
          <div className="mt-4">
            <a href="/" className="btn-secondary">
              Retry loading
            </a>
          </div>
        </div>
      )}

      {data.transactionCount === 0 ? (
        <div className="card border-dashed border border-slate-200 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">No transactions yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Upload your first CSV file to start reviewing and categorizing transactions.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/upload" className="btn-primary">
              Upload CSV
            </a>
            <a href="/transactions" className="btn-secondary">
              View transactions
            </a>
          </div>
        </div>
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
        <div className="card border-l-4 border-amber-400">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              ⚠️
            </div>
            <div>
              <h3 className="text-sm font-medium text-amber-900">
                {data.unreviewedCount} transaction{data.unreviewedCount !== 1 ? 's' : ''} need review
              </h3>
              <div className="mt-2">
                <a href="/transactions?reviewed=false" className="text-sm font-medium text-amber-700 hover:text-amber-600">
                  Review now
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
