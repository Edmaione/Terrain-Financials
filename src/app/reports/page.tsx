import { generatePLReport, generateCashFlowData } from '@/lib/reports'
import PLReport from '@/components/PLReport'
import CashFlowChart from '@/components/CashFlowChart'

async function getReports() {
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const startDate = firstDayOfMonth.toISOString().split('T')[0]
  const endDate = lastDayOfMonth.toISOString().split('T')[0]

  const [plReport, cashFlowData] = await Promise.all([
    generatePLReport(startDate, endDate),
    generateCashFlowData(startDate, endDate, 'day'),
  ])

  return { plReport, cashFlowData, startDate, endDate }
}

export default async function ReportsPage() {
  const { plReport, cashFlowData, startDate, endDate } = await getReports()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">
          Financial reports and analysis for the current month.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Income</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            ${plReport.total_income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Expenses</p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">
            ${plReport.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Gross Profit</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            ${plReport.gross_profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Net Income</p>
          <p
            className={`mt-2 text-2xl font-semibold ${
              plReport.net_income >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            ${plReport.net_income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Cash Flow</h2>
        <p className="text-xs text-slate-500">{new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</p>
        <div className="mt-6">
          <CashFlowChart data={cashFlowData} />
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Profit & Loss Statement</h2>
            <p className="text-xs text-slate-500">
              {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <PLReport report={plReport} />
        </div>
      </div>
    </div>
  )
}
