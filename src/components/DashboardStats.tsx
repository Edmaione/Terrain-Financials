export default function DashboardStats({
  currentCash,
  monthlyRevenue,
  monthlyExpenses,
  monthlyProfit,
  unreviewedCount,
}: {
  currentCash: number
  monthlyRevenue: number
  monthlyExpenses: number
  monthlyProfit: number
  unreviewedCount: number
}) {
  const stats = [
    {
      name: 'Current Cash',
      value: `$${currentCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      helper: 'Across active accounts',
      changeType: 'neutral',
    },
    {
      name: 'Monthly Revenue',
      value: `$${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      helper: 'This month',
      changeType: 'positive',
    },
    {
      name: 'Monthly Expenses',
      value: `$${monthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      helper: 'This month',
      changeType: 'neutral',
    },
    {
      name: 'Monthly Profit',
      value: `$${monthlyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      helper: unreviewedCount > 0 ? `${unreviewedCount} need review` : 'All reviewed',
      changeType: monthlyProfit >= 0 ? 'positive' : 'negative',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.name} className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{stat.name}</p>
              <p
                className={`mt-2 text-2xl font-semibold ${
                  stat.changeType === 'positive'
                    ? 'text-emerald-600'
                    : stat.changeType === 'negative'
                    ? 'text-rose-600'
                    : 'text-slate-900'
                }`}
              >
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{stat.helper}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
