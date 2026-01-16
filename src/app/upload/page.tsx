import CSVUploader from '@/components/CSVUploader'

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Transactions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload CSV files from your bank accounts to import transactions
        </p>
      </div>
      
      <div className="card max-w-3xl">
        <CSVUploader />
      </div>
      
      <div className="card max-w-3xl bg-blue-50 border border-blue-200">
        <h3 className="text-sm font-medium text-blue-900 mb-2">💡 Tips for uploading</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
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
