import { supabaseAdmin } from '@/lib/supabase'
import { generateWeeklySummary } from '@/lib/reports'
import WeeklySummary from '@/components/WeeklySummary'
import DashboardStats from '@/components/DashboardStats'

async function getDashboardData() {
  try {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);

    // Get weekly summary
    const weeklySummary = await generateWeeklySummary(
      weekStart.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );

    // Get unreviewed count
    const { count: unreviewedCount, error: countError } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('reviewed', false);

    if (countError) {
      console.error('[Dashboard] Unreviewed count error:', countError);
    }

    // Get current month stats
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const { data: monthTransactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .gte('date', monthStart.toISOString().split('T')[0]);

    if (txError) {
      console.error('[Dashboard] Month transactions error:', txError);
    }

    let monthlyRevenue = 0;
    let monthlyExpenses = 0;

    monthTransactions?.forEach((t) => {
      if (t.amount > 0) {
        monthlyRevenue += t.amount;
      } else {
        monthlyExpenses += Math.abs(t.amount);
      }
    });

    // Get cash position (simplified - sum of all account balances)
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('current_balance')
      .eq('is_active', true);

    if (accountsError) {
      console.error('[Dashboard] Accounts error:', accountsError);
    }

    const currentCash =
      accounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) || 0;

    return {
      weeklySummary,
      unreviewedCount: unreviewedCount || 0,
      monthlyRevenue,
      monthlyExpenses,
      monthlyProfit: monthlyRevenue - monthlyExpenses,
      currentCash,
      error: null,
    };
  } catch (error) {
    console.error('[Dashboard] Fatal error:', error);
    return {
      weeklySummary: null,
      unreviewedCount: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      monthlyProfit: 0,
      currentCash: 0,
      error: error instanceof Error ? error.message : 'Failed to load dashboard',
    };
  }
}

export default async function Dashboard() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Financial overview for Maione Landscapes LLC
        </p>
      </div>

      {data.error && (
        <div className="card border-l-4 border-red-400 bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading dashboard data
              </h3>
              <p className="mt-1 text-sm text-red-700">{data.error}</p>
            </div>
          </div>
        </div>
      )}

      <DashboardStats
        currentCash={data.currentCash}
        monthlyRevenue={data.monthlyRevenue}
        monthlyExpenses={data.monthlyExpenses}
        monthlyProfit={data.monthlyProfit}
        unreviewedCount={data.unreviewedCount}
      />

      {data.weeklySummary && <WeeklySummary summary={data.weeklySummary} />}

      {data.unreviewedCount > 0 && (
        <div className="card border-l-4 border-yellow-400">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {data.unreviewedCount} transaction
                {data.unreviewedCount !== 1 ? 's' : ''} need review
              </h3>
              <div className="mt-2">
                <a
                  href="/transactions?reviewed=false"
                  className="text-sm font-medium text-yellow-700 hover:text-yellow-600"
                >
                  Review now →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
