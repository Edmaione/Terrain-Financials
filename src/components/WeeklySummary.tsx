import { WeeklySummary as WeeklySummaryType } from '@/types'

export default function WeeklySummary({ summary }: { summary: WeeklySummaryType }) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Summary</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500">Income</p>
          <p className="text-xl font-semibold text-green-600">
            +${summary.total_income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Expenses</p>
          <p className="text-xl font-semibold text-red-600">
            -${summary.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Net Change</p>
          <p className={`text-xl font-semibold ${summary.net_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {summary.net_change >= 0 ? '+' : ''}${summary.net_change.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Top Expenses This Week</h3>
        <div className="space-y-2">
          {summary.top_expenses.map((expense, idx) => (
            <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{expense.payee}</p>
                <p className="text-xs text-gray-500">{expense.category}</p>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
          {summary.top_expenses.length === 0 && (
            <p className="text-sm text-gray-500 italic">No expenses this week</p>
          )}
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          {summary.transaction_count} total transactions
          {summary.unreviewed_count > 0 && (
            <span className="ml-2 text-yellow-600 font-medium">
              • {summary.unreviewed_count} need review
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
