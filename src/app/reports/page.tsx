import { redirect } from 'next/navigation'
import { generatePLReport, generateCashFlowData } from '@/lib/reports'
import PLReport from '@/components/PLReport'
import CashFlowChart from '@/components/CashFlowChart'
import ReportsFilters from '@/components/ReportsFilters'
import { parseDateRange, getDateRangeLabel, DateRangePreset } from '@/lib/date-utils'
import { resolveAccountSelection } from '@/lib/accounts'
import PageHeader from '@/components/PageHeader'

async function getReports(startDate: string, endDate: string, accountId?: string) {
  try {
    const [plReport, cashFlowData] = await Promise.all([
      generatePLReport(startDate, endDate, accountId),
      generateCashFlowData(startDate, endDate, 'day', accountId),
    ])

    return { plReport, cashFlowData, error: null }
  } catch (error) {
    console.error('[reports] Failed to load reports', error)
    return {
      plReport: {
        period_start: startDate,
        period_end: endDate,
        total_income: 0,
        total_cogs: 0,
        gross_profit: 0,
        total_expenses: 0,
        net_operating_income: 0,
        other_income: 0,
        other_expenses: 0,
        net_income: 0,
        lines: [],
      },
      cashFlowData: [],
      error: error instanceof Error ? error.message : 'Failed to load reports',
    }
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { range?: string; start?: string; end?: string; account_id?: string }
}) {
  const { accounts, selectedAccount, needsRedirect } = await resolveAccountSelection(
    searchParams.account_id
  )

  const range = searchParams.range ?? 'last_3_months'
  const { startDate, endDate } = parseDateRange(range, searchParams.start, searchParams.end)
  const needsDefaults = !searchParams.range || !searchParams.account_id

  if (selectedAccount && (needsRedirect || needsDefaults)) {
    const params = new URLSearchParams()
    params.set('account_id', selectedAccount.id)
    params.set('range', range)
    if (range === 'custom') {
      params.set('start', startDate)
      params.set('end', endDate)
    }
    redirect(`/reports?${params.toString()}`)
  }

  if (!selectedAccount) {
    return (
      <div className="card border border-rose-200 bg-rose-50 text-rose-900">
        <h2 className="text-sm font-semibold">No account available.</h2>
        <p className="text-sm text-rose-700 mt-1">
          Create or activate an account to view reports.
        </p>
      </div>
    )
  }

  const { plReport, cashFlowData, error } = await getReports(
    startDate,
    endDate,
    selectedAccount?.id
  )
  const rangeLabel = getDateRangeLabel(range as DateRangePreset)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Financial reports and analysis for your selected account."
        actions={(
          <a href="/transactions" className="btn-secondary">
            View transactions
          </a>
        )}
      />

      <ReportsFilters
        range={range}
        startDate={startDate}
        endDate={endDate}
        accounts={accounts}
        accountId={selectedAccount?.id}
      />

      {error && (
        <div className="card border border-rose-200 bg-rose-50 text-rose-900">
          <h2 className="text-sm font-semibold">Reports are unavailable.</h2>
          <p className="text-sm text-rose-700 mt-1">{error}</p>
        </div>
      )}

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
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">Cash Flow</h2>
          <p className="text-xs text-slate-500">
            {rangeLabel} · {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
          </p>
        </div>
        <div className="mt-6">
          {cashFlowData.length > 0 ? (
            <CashFlowChart data={cashFlowData} />
          ) : (
            <div className="card-muted text-sm text-slate-500">
              No cash flow data for this period. Try expanding your date range.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Profit and Loss Statement</h2>
            <p className="text-xs text-slate-500">
              {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="mt-6">
          {plReport.lines.length > 0 ? (
            <PLReport report={plReport} />
          ) : (
            <div className="card-muted text-sm text-slate-500">
              No reviewed transactions in this period. Review transactions or adjust your range.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
