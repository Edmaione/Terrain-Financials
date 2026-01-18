import Link from 'next/link'
import CSVUploader from '@/components/CSVUploader'
import { fetchActiveAccounts } from '@/lib/accounts'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/design-system/components/Button'
import { Card } from '@/design-system/components/Card'
import { colors } from '@/design-system/tokens'
import { tokenVar } from '@/design-system/utils'

export default async function UploadPage({
  searchParams,
}: {
  searchParams: { account_id?: string }
}) {
  const accounts = await fetchActiveAccounts()
  const selectedAccountId = searchParams.account_id ?? null

  if (accounts.length === 0) {
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
          <Button as={Link} href="/transactions?reviewed=false" variant="secondary" size="sm">
            Review unreviewed
          </Button>
        )}
      />

      <Card className="max-w-4xl" padding={5}>
        <CSVUploader
          accounts={accounts}
          selectedAccountId={selectedAccountId}
        />
      </Card>

      <Card
        className="max-w-4xl border"
        padding={5}
        style={{
          borderColor: tokenVar('gray-200', colors.gray[200]),
          backgroundColor: tokenVar('gray-100', colors.gray[100]),
        }}
      >
        <h3
          className="mb-2 text-sm font-semibold"
          style={{ color: tokenVar('gray-900', colors.gray[900]) }}
        >
          Tips for uploading
        </h3>
        <ul
          className="list-inside list-disc text-sm"
          style={{ color: tokenVar('gray-600', colors.gray[600]) }}
        >
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
