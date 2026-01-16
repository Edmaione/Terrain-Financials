'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CategorySelect from './CategorySelect';

interface TransactionTableProps {
  transactions: any[];
}

export default function TransactionTable({
  transactions,
}: TransactionTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{
    [key: string]: string;
  }>({});

  const handleApproveWithAI = async (
    transactionId: string,
    aiCategoryId: string
  ) => {
    setProcessing(transactionId);
    setError(null);

    try {
      const response = await fetch(`/api/transactions/${transactionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: aiCategoryId }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to approve transaction');
      }

      // Refresh the page data
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error('[TransactionTable] Approve error:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleCategorizeAndApprove = async (transactionId: string) => {
    const categoryId = selectedCategory[transactionId];

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    setProcessing(transactionId);
    setError(null);

    try {
      const response = await fetch(`/api/transactions/${transactionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to approve transaction');
      }

      // Collapse the row and refresh
      setExpandedRow(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error('[TransactionTable] Categorize error:', err);
      setError(err instanceof Error ? err.message : 'Failed to categorize');
    } finally {
      setProcessing(null);
    }
  };

  const toggleExpanded = (transactionId: string) => {
    setExpandedRow(expandedRow === transactionId ? null : transactionId);
    setError(null);
  };

  if (transactions.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No transactions found</p>
        <p className="text-sm text-gray-400 mt-2">
          Try adjusting your filters or upload new transactions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="card border-l-4 border-red-400 bg-red-50">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => {
                const isExpanded = expandedRow === transaction.id;
                const isProcessing = processing === transaction.id;

                return (
                  <>
                    <tr
                      key={transaction.id}
                      className={!transaction.reviewed ? 'bg-yellow-50' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{transaction.payee}</div>
                        {transaction.account && (
                          <div className="text-xs text-gray-500">
                            {transaction.account.name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                        <div className="truncate">
                          {transaction.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {transaction.reviewed ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {transaction.category?.name || 'Uncategorized'}
                            </div>
                            {transaction.category?.section && (
                              <div className="text-xs text-gray-500">
                                {transaction.category.section}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-blue-600">
                              {transaction.ai_suggested?.name ||
                                'Needs categorization'}
                            </div>
                            {transaction.ai_confidence && (
                              <div className="text-xs text-gray-500">
                                {Math.round(transaction.ai_confidence * 100)}%
                                confidence
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                          transaction.amount >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {transaction.amount >= 0 ? '+' : ''}$
                        {Math.abs(transaction.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {transaction.is_transfer ? (
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            Transfer
                          </span>
                        ) : transaction.reviewed ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            Reviewed
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        {!transaction.reviewed && (
                          <>
                            {transaction.ai_suggested_category && (
                              <button
                                onClick={() =>
                                  handleApproveWithAI(
                                    transaction.id,
                                    transaction.ai_suggested_category
                                  )
                                }
                                disabled={isProcessing || isPending}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              >
                                {isProcessing ? 'Approving...' : '✓ Approve AI'}
                              </button>
                            )}
                            <button
                              onClick={() => toggleExpanded(transaction.id)}
                              disabled={isProcessing || isPending}
                              className="text-primary-600 hover:text-primary-900 disabled:opacity-50"
                            >
                              {isExpanded ? 'Cancel' : '✏ Categorize'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>

                    {/* Expanded row for manual categorization */}
                    {isExpanded && !transaction.reviewed && (
                      <tr className="bg-blue-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="flex items-end gap-4">
                            <div className="flex-1">
                              <label className="label text-xs">
                                Select Category
                              </label>
                              <CategorySelect
                                value={selectedCategory[transaction.id]}
                                onChange={(value) =>
                                  setSelectedCategory((prev) => ({
                                    ...prev,
                                    [transaction.id]: value,
                                  }))
                                }
                                disabled={isProcessing}
                                placeholder="Choose a category..."
                              />
                            </div>
                            <button
                              onClick={() =>
                                handleCategorizeAndApprove(transaction.id)
                              }
                              disabled={
                                isProcessing ||
                                !selectedCategory[transaction.id]
                              }
                              className="btn-primary disabled:opacity-50"
                            >
                              {isProcessing
                                ? 'Saving...'
                                : 'Categorize & Approve'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
