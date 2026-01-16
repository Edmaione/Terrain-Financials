import { supabaseAdmin } from '@/lib/supabase'
import { generateWeeklySummary } from '@/lib/reports'
import WeeklySummary from '@/components/WeeklySummary'
import DashboardStats from '@/components/DashboardStats'

async function getDashboardData() {
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - 7)
  
  // Get weekly summary
  const weeklySummary = await generateWeeklySummary(
    weekStart.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  )
  
  // Get unreviewed count
  const { count: unreviewedCount } = await supabaseAdmin
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('reviewed', false)
  
  // Get current month stats
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const { data: monthTransactions } = await supabaseAdmin
    .from('transactions')
    .select('amount, category:categories!category_id(type)')
    .gte('date', monthStart.toISOString().split('T')[0])
  
  let monthlyRevenue = 0
  let monthlyExpenses = 0
  
  monthTransactions?.forEach(t => {
    if (t.amount > 0) {
      monthlyRevenue += t.amount
    } else {
      monthlyExpenses += Math.abs(t.amount)
    }
  })
  
  // Get cash position (simplified - sum of all account balances)
  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('current_balance')
    .eq('is_active', true)
  
  const currentCash = accounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) || 0
  
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
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
        <div className="card border-l-4 border-yellow-400">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {data.unreviewedCount} transaction{data.unreviewedCount !== 1 ? 's' : ''} need review
              </h3>
              <div className="mt-2">
                <a href="/transactions?reviewed=false" className="text-sm font-medium text-yellow-700 hover:text-yellow-600">
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
