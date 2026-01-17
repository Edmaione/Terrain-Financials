import { redirect } from 'next/navigation'
import Link from 'next/link'
import CSVUploader from '@/components/CSVUploader'
import { resolveAccountSelection } from '@/lib/accounts'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import { Card } from '@/components/ui/Card'
import { buttonVariants } from '@/components/ui/Button'

export default async function UploadPage({
  searchParams,
}: {
  searchParams: { account_id?: string }
}) {
  const { accounts, selectedAccount, needsRedirect } = await resolveAccountSelection(
    searchParams.account_id
  )

  if (selectedAccount && needsRedirect) {
    const params = new URLSearchParams()
    params.set('account_id', selectedAccount.id)
    redirect(`/upload?${params.toString()}`)
  }

  if (!selectedAccount) {
    return (
      <AlertBanner
        variant="error"
        title="No account available."
        message="Create or activate an account before uploading transactions."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        label="Upload"
        title="Upload transactions"
        description="Import CSV files from your bank to keep transactions up to date."
        actions={(
          <Link href="/transactions?reviewed=false" className={buttonVariants({ variant: 'secondary' })}>
            Review unreviewed
          </Link>
        )}
      />

      <Card className="max-w-4xl p-5">
        <CSVUploader
          accounts={accounts}
          selectedAccountId={selectedAccount?.id ?? null}
        />
      </Card>

      <Card className="max-w-4xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Tips for uploading</h3>
        <ul className="space-y-1 list-inside list-disc text-sm text-slate-600">
          <li>You can upload multiple CSV files at once.</li>
          <li>The system auto-detects your bank format.</li>
          <li>Duplicate transactions are automatically filtered out.</li>
          <li>AI will categorize transactions based on learned patterns.</li>
          <li>Review and approve AI suggestions before finalizing.</li>
        </ul>
      </Card>
    </div>
  )
}
