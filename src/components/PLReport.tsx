import { PLReport as PLReportType } from '@/types'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'

export default function PLReport({ report }: { report: PLReportType }) {
  const formatMoney = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableBody className="divide-y divide-slate-200">
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead colSpan={2} className="text-slate-600">
              Income
            </TableHead>
          </TableRow>
          {report.lines
            .filter((line) => line.section === 'Income')
            .map((line) => (
              <TableRow key={line.category_id}>
                <TableCell className="text-slate-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                  {line.category_name}
                </TableCell>
                <TableCell className="text-right font-medium text-slate-900">
                  ${formatMoney(line.amount)}
                </TableCell>
              </TableRow>
            ))}
          <TableRow className="bg-slate-100 font-semibold hover:bg-slate-100">
            <TableCell className="text-slate-900">Total Income</TableCell>
            <TableCell className="text-right text-slate-900">
              ${formatMoney(report.total_income)}
            </TableCell>
          </TableRow>

          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead colSpan={2} className="text-slate-600">
              Cost of Goods Sold
            </TableHead>
          </TableRow>
          {report.lines
            .filter((line) => line.section === 'Cost of Goods Sold')
            .map((line) => (
              <TableRow key={line.category_id} className={line.is_parent ? 'font-medium' : ''}>
                <TableCell className="text-slate-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                  {line.category_name}
                </TableCell>
                <TableCell className="text-right text-slate-900">
                  ${formatMoney(line.amount)}
                </TableCell>
              </TableRow>
            ))}
          <TableRow className="bg-slate-100 font-semibold hover:bg-slate-100">
            <TableCell className="text-slate-900">Total Cost of Goods Sold</TableCell>
            <TableCell className="text-right text-slate-900">
              ${formatMoney(report.total_cogs)}
            </TableCell>
          </TableRow>

          <TableRow className="bg-slate-900 text-white font-semibold hover:bg-slate-900">
            <TableCell className="text-white">Gross Profit</TableCell>
            <TableCell className="text-right text-white">${formatMoney(report.gross_profit)}</TableCell>
          </TableRow>

          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead colSpan={2} className="text-slate-600">
              Expenses
            </TableHead>
          </TableRow>
          {report.lines
            .filter((line) => line.section === 'Expenses')
            .map((line) => (
              <TableRow key={line.category_id} className={line.is_parent ? 'font-medium' : ''}>
                <TableCell className="text-slate-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                  {line.category_name}
                </TableCell>
                <TableCell className="text-right text-slate-900">
                  ${formatMoney(line.amount)}
                </TableCell>
              </TableRow>
            ))}
          <TableRow className="bg-slate-100 font-semibold hover:bg-slate-100">
            <TableCell className="text-slate-900">Total Expenses</TableCell>
            <TableCell className="text-right text-slate-900">
              ${formatMoney(report.total_expenses)}
            </TableCell>
          </TableRow>

          <TableRow className="bg-slate-900 text-white font-semibold hover:bg-slate-900">
            <TableCell className="text-white">Net Operating Income</TableCell>
            <TableCell className="text-right text-white">${formatMoney(report.net_operating_income)}</TableCell>
          </TableRow>

          {report.other_income > 0 && (
            <>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead colSpan={2} className="text-slate-600">
                  Other Income
                </TableHead>
              </TableRow>
              {report.lines
                .filter((line) => line.section === 'Other Income')
                .map((line) => (
                  <TableRow key={line.category_id}>
                    <TableCell className="text-slate-900" style={{ paddingLeft: `${line.indent_level * 1}rem` }}>
                      {line.category_name}
                    </TableCell>
                    <TableCell className="text-right text-slate-900">
                      ${formatMoney(line.amount)}
                    </TableCell>
                  </TableRow>
                ))}
            </>
          )}

          <TableRow className="border-t border-slate-200 bg-emerald-50 font-semibold hover:bg-emerald-50">
            <TableCell className="text-slate-900">Net Income</TableCell>
            <TableCell
              className={`text-right ${
                report.net_income >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              ${formatMoney(report.net_income)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
