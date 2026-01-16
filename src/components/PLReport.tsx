import { PLReport as PLReportType } from '@/types'

export default function PLReport({ report }: { report: PLReportType }) {
  const formatMoney = (amount: number) => {
    return amount.toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <tbody className="divide-y divide-gray-200">
          {/* Income Section */}
          <tr className="bg-gray-50">
            <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">
              INCOME
            </td>
          </tr>
          {report.lines
            .filter(line => line.section === 'Income')
            .map(line => (
              <tr key={line.category_id}>
                <td className="px-4 py-2 text-sm text-gray-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                  {line.category_name}
                </td>
                <td className="px-4 py-2 text-sm text-right text-gray-900 font-medium">
                  ${formatMoney(line.amount)}
                </td>
              </tr>
            ))}
          <tr className="bg-gray-100 font-semibold">
            <td className="px-4 py-2 text-sm text-gray-900">Total Income</td>
            <td className="px-4 py-2 text-sm text-right text-gray-900">
              ${formatMoney(report.total_income)}
            </td>
          </tr>
          
          {/* COGS Section */}
          <tr className="bg-gray-50">
            <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">
              COST OF GOODS SOLD
            </td>
          </tr>
          {report.lines
            .filter(line => line.section === 'Cost of Goods Sold')
            .map(line => (
              <tr key={line.category_id} className={line.is_parent ? 'font-medium' : ''}>
                <td className="px-4 py-2 text-sm text-gray-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                  {line.category_name}
                </td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  ${formatMoney(line.amount)}
                </td>
              </tr>
            ))}
          <tr className="bg-gray-100 font-semibold">
            <td className="px-4 py-2 text-sm text-gray-900">Total Cost of Goods Sold</td>
            <td className="px-4 py-2 text-sm text-right text-gray-900">
              ${formatMoney(report.total_cogs)}
            </td>
          </tr>
          
          {/* Gross Profit */}
          <tr className="bg-primary-50 font-bold">
            <td className="px-4 py-3 text-sm text-gray-900">GROSS PROFIT</td>
            <td className="px-4 py-3 text-sm text-right text-gray-900">
              ${formatMoney(report.gross_profit)}
            </td>
          </tr>
          
          {/* Expenses Section */}
          <tr className="bg-gray-50">
            <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">
              EXPENSES
            </td>
          </tr>
          {report.lines
            .filter(line => line.section === 'Expenses')
            .map(line => (
              <tr key={line.category_id} className={line.is_parent ? 'font-medium' : ''}>
                <td className="px-4 py-2 text-sm text-gray-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                  {line.category_name}
                </td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  ${formatMoney(line.amount)}
                </td>
              </tr>
            ))}
          <tr className="bg-gray-100 font-semibold">
            <td className="px-4 py-2 text-sm text-gray-900">Total Expenses</td>
            <td className="px-4 py-2 text-sm text-right text-gray-900">
              ${formatMoney(report.total_expenses)}
            </td>
          </tr>
          
          {/* Net Operating Income */}
          <tr className="bg-primary-50 font-bold">
            <td className="px-4 py-3 text-sm text-gray-900">NET OPERATING INCOME</td>
            <td className="px-4 py-3 text-sm text-right text-gray-900">
              ${formatMoney(report.net_operating_income)}
            </td>
          </tr>
          
          {/* Other Income */}
          {report.other_income > 0 && (
            <>
              <tr className="bg-gray-50">
                <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">
                  OTHER INCOME
                </td>
              </tr>
              {report.lines
                .filter(line => line.section === 'Other Income')
                .map(line => (
                  <tr key={line.category_id}>
                    <td className="px-4 py-2 text-sm text-gray-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                      {line.category_name}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-900">
                      ${formatMoney(line.amount)}
                    </td>
                  </tr>
                ))}
            </>
          )}
          
          {/* Net Income */}
          <tr className="bg-green-50 font-bold border-t-2 border-gray-300">
            <td className="px-4 py-4 text-sm text-gray-900">NET INCOME</td>
            <td className={`px-4 py-4 text-sm text-right font-bold ${
              report.net_income >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${formatMoney(report.net_income)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
