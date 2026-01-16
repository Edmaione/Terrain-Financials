import { WeeklySummary as WeeklySummaryType } from '@/types'

export default function WeeklySummary({ summary }: { summary: WeeklySummaryType }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Weekly Summary</h2>
          <p className="text-xs text-slate-500">Last 7 days performance snapshot</p>
        </div>
        <span className="badge badge-amber">{summary.unreviewed_count} pending</span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card-muted">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Income</p>
          <p className="mt-2 text-xl font-semibold text-emerald-600">
            +${summary.total_income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card-muted">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expenses</p>
          <p className="mt-2 text-xl font-semibold text-rose-600">
            -${summary.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card-muted">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Net Change</p>
          <p
            className={`mt-2 text-xl font-semibold ${
              summary.net_change >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {summary.net_change >= 0 ? '+' : ''}${summary.net_change.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-slate-700">Top Expenses This Week</h3>
        <div className="mt-3 space-y-2">
          {summary.top_expenses.map((expense, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{expense.payee}</p>
                <p className="text-xs text-slate-500">{expense.category}</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
          {summary.top_expenses.length === 0 && (
            <p className="text-sm text-slate-500 italic">No expenses this week</p>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">
          {summary.transaction_count} total transactions
          {summary.unreviewed_count > 0 && (
            <span className="ml-2 text-amber-600 font-medium">
              • {summary.unreviewed_count} need review
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
