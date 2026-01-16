import CSVUploader from '@/components/CSVUploader'

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Upload Transactions</h1>
        <p className="text-sm text-slate-500">
          Upload CSV files from your bank accounts to import transactions.
        </p>
      </div>

      <div className="card max-w-4xl">
        <CSVUploader />
      </div>

      <div className="card max-w-4xl border border-slate-200 bg-slate-50">
        <h3 className="text-sm font-medium text-slate-900 mb-2">Tips for uploading</h3>
        <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
          <li>You can upload multiple CSV files at once</li>
          <li>The system auto-detects your bank format (Relay, Chase, etc.)</li>
          <li>Duplicate transactions are automatically filtered out</li>
          <li>AI will categorize transactions based on learned patterns</li>
          <li>Review and approve AI suggestions before finalizing</li>
        </ul>
      </div>
    </div>
  )
}
