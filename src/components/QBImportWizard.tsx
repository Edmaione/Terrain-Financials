'use client';

import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { QBAccountClassification, QBAccountMap, QBAnalysisResult, QBExecuteResult } from '@/lib/qb-import/types';
import { cn } from '@/lib/utils';

type Step = 'upload' | 'mappings' | 'preview' | 'executing' | 'done';

export default function QBImportWizard() {
  const [step, setStep] = useState<Step>('upload');
  const [fileText, setFileText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [analysis, setAnalysis] = useState<QBAnalysisResult | null>(null);
  const [accountMap, setAccountMap] = useState<QBAccountMap>({});
  const [result, setResult] = useState<QBExecuteResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Step 1: Upload
  const handleFile = useCallback(async (file: File) => {
    setError('');
    setLoading(true);
    try {
      const text = await file.text();
      setFileText(text);
      setFileName(file.name);

      const data = await apiRequest<QBAnalysisResult>('/api/imports/quickbooks/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileText: text }),
      });

      setAnalysis(data);

      // Build initial account map from classifications
      const map: QBAccountMap = {};
      for (const c of data.classifications) {
        map[c.qbName] = {
          type: c.type,
          systemId: c.systemId,
        };
      }
      setAccountMap(map);
      setStep('mappings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Step 2: Update mapping
  const updateMapping = useCallback((qbName: string, type: 'bank_account' | 'category') => {
    setAccountMap(prev => ({
      ...prev,
      [qbName]: { ...prev[qbName], type },
    }));
  }, []);

  // Step 3: Execute
  const handleExecute = useCallback(async () => {
    setError('');
    setLoading(true);
    setStep('executing');
    try {
      const data = await apiRequest<QBExecuteResult>('/api/imports/quickbooks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileText, accountMap, options: { createMissing: true } }),
      });

      setResult(data);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('mappings');
    } finally {
      setLoading(false);
    }
  }, [fileText, accountMap]);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'mappings', 'preview', 'done'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-slate-200" />}
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
              step === s || (s === 'preview' && step === 'executing')
                ? 'bg-emerald-600 text-white'
                : ['upload', 'mappings', 'preview', 'executing', 'done'].indexOf(step) > ['upload', 'mappings', 'preview', 'executing', 'done'].indexOf(s)
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
            )}>
              {i + 1}
            </div>
            <span className={cn(
              'text-xs font-medium',
              step === s ? 'text-slate-900' : 'text-slate-400'
            )}>
              {s === 'upload' ? 'Upload' : s === 'mappings' ? 'Map Accounts' : s === 'preview' ? 'Import' : 'Done'}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center hover:border-emerald-400 hover:bg-emerald-50/30"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {loading ? (
            <p className="text-sm text-slate-600">Analyzing file...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">
                Drop QuickBooks General Ledger CSV here
              </p>
              <p className="mt-1 text-xs text-slate-500">or click to select</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
                style={{ position: 'relative' }}
              />
            </>
          )}
        </div>
      )}

      {/* Step 2: Mappings */}
      {step === 'mappings' && analysis && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">File Summary</h3>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-slate-500">Rows</p>
                <p className="font-medium">{analysis.stats.totalRows.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500">Date Range</p>
                <p className="font-medium">{analysis.stats.dateRange.start} - {analysis.stats.dateRange.end}</p>
              </div>
              <div>
                <p className="text-slate-500">Unique Accounts</p>
                <p className="font-medium">{analysis.stats.uniqueAccounts}</p>
              </div>
              <div>
                <p className="text-slate-500">File</p>
                <p className="font-medium truncate">{fileName}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-slate-500">Expenses</p>
                <p className="font-medium">{analysis.stats.transactionTypes.expenses}</p>
              </div>
              <div>
                <p className="text-slate-500">Income</p>
                <p className="font-medium">{analysis.stats.transactionTypes.income}</p>
              </div>
              <div>
                <p className="text-slate-500">Transfers</p>
                <p className="font-medium">{analysis.stats.transactionTypes.transfers}</p>
              </div>
              <div>
                <p className="text-slate-500">Journal Entries (skip)</p>
                <p className="font-medium">{analysis.stats.transactionTypes.journalEntries}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Account Mappings</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Confirm each QB account as a bank account or category. Low-confidence items are highlighted.
              </p>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">QB Account Name</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Type</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Confidence</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.classifications.map((cls) => {
                    const mapping = accountMap[cls.qbName];
                    const isLowConf = cls.confidence < 0.8;
                    return (
                      <tr key={cls.qbName} className={cn(isLowConf && 'bg-amber-50/50')}>
                        <td className="px-4 py-2 font-mono text-xs">
                          {cls.qbName}
                          {cls.isDeleted && (
                            <span className="ml-1 text-[10px] text-slate-400">(deleted)</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={mapping?.type || cls.type}
                            onChange={(e) => updateMapping(cls.qbName, e.target.value as 'bank_account' | 'category')}
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                          >
                            <option value="bank_account">Bank Account</option>
                            <option value="category">Category</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <span className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                            cls.confidence >= 0.9 ? 'bg-emerald-100 text-emerald-700' :
                            cls.confidence >= 0.7 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          )}>
                            {Math.round(cls.confidence * 100)}%
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {cls.systemId ? 'Matched' : 'New'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setStep('upload'); setAnalysis(null); setFileText(''); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={handleExecute}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Import Transactions
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Executing */}
      {step === 'executing' && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="mt-4 text-sm font-medium text-slate-700">Importing transactions...</p>
          <p className="mt-1 text-xs text-slate-500">Creating accounts, categories, and transactions</p>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <h3 className="text-lg font-semibold text-emerald-900">Import Complete</h3>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-emerald-700">Inserted</p>
                <p className="text-2xl font-bold text-emerald-900">{result.transactions.inserted}</p>
              </div>
              <div>
                <p className="text-emerald-700">Transfers</p>
                <p className="text-2xl font-bold text-emerald-900">{result.transactions.transfers}</p>
              </div>
              <div>
                <p className="text-emerald-700">Skipped</p>
                <p className="text-2xl font-bold text-slate-600">{result.transactions.skipped}</p>
              </div>
              {result.created.accounts > 0 && (
                <div>
                  <p className="text-emerald-700">New Accounts</p>
                  <p className="text-2xl font-bold text-emerald-900">{result.created.accounts}</p>
                </div>
              )}
              {result.created.categories > 0 && (
                <div>
                  <p className="text-emerald-700">New Categories</p>
                  <p className="text-2xl font-bold text-emerald-900">{result.created.categories}</p>
                </div>
              )}
              {result.transactions.errors > 0 && (
                <div>
                  <p className="text-red-600">Errors</p>
                  <p className="text-2xl font-bold text-red-700">{result.transactions.errors}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href="/transactions"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              View Transactions
            </a>
            <a
              href="/reports"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View Reports
            </a>
            <button
              onClick={() => { setStep('upload'); setAnalysis(null); setFileText(''); setResult(null); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
