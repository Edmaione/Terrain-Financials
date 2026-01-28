import Link from 'next/link'
import { getStatementGrid } from '@/lib/reconciliation'
import StatementGrid from '@/components/reconciliation/StatementGrid'

export default async function ReconcilePage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const year = parseInt(searchParams.year || String(new Date().getFullYear()), 10)
  const grid = await getStatementGrid(year)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reconciliation</h1>
          <p className="text-sm text-slate-500">
            Track bank statement reconciliation across all accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/reconcile?year=${year - 1}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← {year - 1}
          </Link>
          <span className="px-2 text-sm font-semibold text-slate-800">{year}</span>
          <Link
            href={`/reconcile?year=${year + 1}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {year + 1} →
          </Link>
          <Link
            href="/reconcile/new"
            className="ml-4 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Upload Statement
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {grid.length > 0 ? (
          <StatementGrid grid={grid} year={year} />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">
            No active accounts found. Add accounts first.
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-100" /> Reconciled
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-100" /> In progress
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-slate-100" /> Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-slate-50 border border-slate-200" /> No statement
        </span>
      </div>
    </div>
  )
}
