'use client';

import QBImportWizard from '@/components/QBImportWizard';

export default function ImportQBPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import QuickBooks General Ledger</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a QuickBooks General Ledger CSV export to import all 2025 transactions.
        </p>
      </div>
      <QBImportWizard />
    </div>
  );
}
