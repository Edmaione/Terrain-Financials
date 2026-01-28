import Link from 'next/link'
import { fetchActiveAccounts } from '@/lib/accounts'
import StatementUploadForm from '@/components/reconciliation/StatementUploadForm'

export default async function NewStatementPage({
  searchParams,
}: {
  searchParams: { account_id?: string; month?: string }
}) {
  const accounts = await fetchActiveAccounts()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reconcile" className="text-sm text-emerald-600 hover:underline">
          ← Back to reconciliation
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Upload Statement</h1>
        <p className="text-sm text-slate-500">
          Create a new bank statement for reconciliation
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <StatementUploadForm
          accounts={accounts}
          defaultAccountId={searchParams.account_id}
          defaultMonth={searchParams.month}
        />
      </div>
    </div>
  )
}
