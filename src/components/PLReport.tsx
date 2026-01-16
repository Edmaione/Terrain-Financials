import { PLReport as PLReportType } from '@/types'

export default function PLReport({ report }: { report: PLReportType }) {
  const formatMoney = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <tbody className="divide-y divide-slate-200">
          <tr className="bg-slate-50">
            <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Income
            </td>
          </tr>
          {report.lines
            .filter((line) => line.section === 'Income')
            .map((line) => (
              <tr key={line.category_id}>
                <td className="px-4 py-2 text-slate-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                  {line.category_name}
                </td>
                <td className="px-4 py-2 text-right font-medium text-slate-900">
                  ${formatMoney(line.amount)}
                </td>
              </tr>
            ))}
          <tr className="bg-slate-100 font-semibold">
            <td className="px-4 py-2 text-slate-900">Total Income</td>
            <td className="px-4 py-2 text-right text-slate-900">
              ${formatMoney(report.total_income)}
            </td>
          </tr>

          <tr className="bg-slate-50">
            <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cost of Goods Sold
            </td>
          </tr>
          {report.lines
            .filter((line) => line.section === 'Cost of Goods Sold')
            .map((line) => (
              <tr key={line.category_id} className={line.is_parent ? 'font-medium' : ''}>
                <td className="px-4 py-2 text-slate-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                  {line.category_name}
                </td>
                <td className="px-4 py-2 text-right text-slate-900">
                  ${formatMoney(line.amount)}
                </td>
              </tr>
            ))}
          <tr className="bg-slate-100 font-semibold">
            <td className="px-4 py-2 text-slate-900">Total Cost of Goods Sold</td>
            <td className="px-4 py-2 text-right text-slate-900">
              ${formatMoney(report.total_cogs)}
            </td>
          </tr>

          <tr className="bg-slate-900 text-white font-semibold">
            <td className="px-4 py-3">Gross Profit</td>
            <td className="px-4 py-3 text-right">${formatMoney(report.gross_profit)}</td>
          </tr>

          <tr className="bg-slate-50">
            <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Expenses
            </td>
          </tr>
          {report.lines
            .filter((line) => line.section === 'Expenses')
            .map((line) => (
              <tr key={line.category_id} className={line.is_parent ? 'font-medium' : ''}>
                <td className="px-4 py-2 text-slate-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                  {line.category_name}
                </td>
                <td className="px-4 py-2 text-right text-slate-900">
                  ${formatMoney(line.amount)}
                </td>
              </tr>
            ))}
          <tr className="bg-slate-100 font-semibold">
            <td className="px-4 py-2 text-slate-900">Total Expenses</td>
            <td className="px-4 py-2 text-right text-slate-900">
              ${formatMoney(report.total_expenses)}
            </td>
          </tr>

          <tr className="bg-slate-900 text-white font-semibold">
            <td className="px-4 py-3">Net Operating Income</td>
            <td className="px-4 py-3 text-right">${formatMoney(report.net_operating_income)}</td>
          </tr>

          {report.other_income > 0 && (
            <>
              <tr className="bg-slate-50">
                <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Other Income
                </td>
              </tr>
              {report.lines
                .filter((line) => line.section === 'Other Income')
                .map((line) => (
                  <tr key={line.category_id}>
                    <td className="px-4 py-2 text-slate-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                      {line.category_name}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      ${formatMoney(line.amount)}
                    </td>
                  </tr>
                ))}
            </>
          )}

          <tr className="border-t border-slate-200 bg-emerald-50 font-semibold">
            <td className="px-4 py-4 text-slate-900">Net Income</td>
            <td
              className={`px-4 py-4 text-right ${
                report.net_income >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              ${formatMoney(report.net_income)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
