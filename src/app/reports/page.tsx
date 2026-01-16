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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Financial reports and analysis
        </p>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total Income</p>
          <p className="text-2xl font-bold text-green-600">
            ${plReport.total_income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">
            ${plReport.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Gross Profit</p>
          <p className="text-2xl font-bold text-gray-900">
            ${plReport.gross_profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Net Income</p>
          <p className={`text-2xl font-bold ${plReport.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${plReport.net_income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      
      {/* Cash Flow Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow</h2>
        <CashFlowChart data={cashFlowData} />
      </div>
      
      {/* P&L Report */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Profit & Loss Statement
          </h2>
          <p className="text-sm text-gray-500">
            {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
          </p>
        </div>
        <PLReport report={plReport} />
      </div>
    </div>
  )
}
