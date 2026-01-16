import { supabaseAdmin } from '@/lib/supabase'
import { generateWeeklySummary } from '@/lib/reports'
import WeeklySummary from '@/components/WeeklySummary'
import DashboardStats from '@/components/DashboardStats'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  const debugIngest = process.env.INGEST_DEBUG === 'true'
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - 7)

  const weeklySummary = await generateWeeklySummary(
    weekStart.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  )

  const { count: unreviewedCount } = await supabaseAdmin
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('reviewed', false)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const { data: monthTransactions } = await supabaseAdmin
    .from('transactions')
    .select('amount, category:categories!category_id(type)')
    .gte('date', monthStart.toISOString().split('T')[0])

  let monthlyRevenue = 0
  let monthlyExpenses = 0

  monthTransactions?.forEach((t) => {
    if (t.amount > 0) {
      monthlyRevenue += t.amount
    } else {
      monthlyExpenses += Math.abs(t.amount)
    }
  })

  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('current_balance')
    .eq('is_active', true)

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
    monthlyRevenue,
    monthlyExpenses,
    monthlyProfit: monthlyRevenue - monthlyExpenses,
    currentCash,
  }
}

export default async function Dashboard() {
  const data = await getDashboardData()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overview</p>
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Financial overview for Maione Landscapes LLC
        </p>
      </div>

      <DashboardStats
        currentCash={data.currentCash}
        monthlyRevenue={data.monthlyRevenue}
        monthlyExpenses={data.monthlyExpenses}
        monthlyProfit={data.monthlyProfit}
        unreviewedCount={data.unreviewedCount}
      />

      <WeeklySummary summary={data.weeklySummary} />

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
                  Review now →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
