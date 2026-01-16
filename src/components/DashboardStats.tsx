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
      change: null,
      changeType: 'neutral',
    },
    {
      name: 'Monthly Revenue',
      value: `$${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: null,
      changeType: 'positive',
    },
    {
      name: 'Monthly Expenses',
      value: `$${monthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: null,
      changeType: 'neutral',
    },
    {
      name: 'Monthly Profit',
      value: `$${monthlyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: null,
      changeType: monthlyProfit >= 0 ? 'positive' : 'negative',
    },
  ]
  
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.name} className="card">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 truncate">{stat.name}</p>
              <p className={`mt-1 text-2xl font-semibold ${
                stat.changeType === 'positive' ? 'text-green-600' :
                stat.changeType === 'negative' ? 'text-red-600' :
                'text-gray-900'
              }`}>
                {stat.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
