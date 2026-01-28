import Link from 'next/link'
import { notFound } from 'next/navigation'
import { computeReconciliationSummary } from '@/lib/reconciliation'
import ReconcileWorkspace from '@/components/reconciliation/ReconcileWorkspace'

export default async function ReconcileWorkspacePage({
  params,
}: {
  params: { id: string }
}) {
  const summary = await computeReconciliationSummary(params.id)
  if (!summary) notFound()

  const accountName = summary.statement.account?.name || 'Unknown Account'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reconcile" className="text-sm text-emerald-600 hover:underline">
          ← Back to reconciliation
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">
          Reconcile: {accountName}
        </h1>
        <p className="text-sm text-slate-500">
          {summary.statement.period_start} to {summary.statement.period_end}
          {summary.statement.status === 'reconciled' && (
            <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Reconciled
            </span>
          )}
        </p>
      </div>

      <ReconcileWorkspace
        initialSummary={summary}
        statementId={params.id}
      />
    </div>
  )
}
