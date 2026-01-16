'use client'

import { useMemo, useState } from 'react'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default function TransactionTable({ transactions }: { transactions: any[] }) {
  const [processing, setProcessing] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions
    const query = searchQuery.toLowerCase()
    return transactions.filter((transaction) => {
      const haystack = [
        transaction.payee,
        transaction.description,
        transaction.account?.name,
        transaction.transfer_to_account?.name,
        transaction.category?.name,
        transaction.ai_suggested?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [searchQuery, transactions])
  
  const handleApprove = async (transactionId: string, categoryId: string) => {
    setProcessing(transactionId)
    
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transactionId,
          category_id: categoryId,
          reviewed: true,
        }),
      })
      
      if (!response.ok) throw new Error('Failed to update')
      
      window.location.reload()
    } catch (error) {
      alert('Failed to approve transaction')
    } finally {
      setProcessing(null)
    }
  }
  
  if (transactions.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No transactions found.</p>
        <p className="mt-2 text-sm text-gray-400">
          Try adjusting filters, or upload a file to get started.
        </p>
      </div>
    )
  }
  
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-gray-200 bg-white px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Transactions</h2>
          <p className="text-xs text-gray-500">
            Showing {filteredTransactions.length} of {transactions.length}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search payee, description, or account"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-72"
          />
        </div>
      </div>
      {filteredTransactions.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-gray-500">No transactions match your filters.</p>
          <p className="mt-2 text-sm text-gray-400">Try a different search or reset the filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
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
              {filteredTransactions.map((transaction) => {
                const isPositive = transaction.amount >= 0
                const accountName = transaction.account?.name || 'Unassigned'
                const transferName = transaction.transfer_to_account?.name
                return (
                  <tr key={transaction.id} className={!transaction.reviewed ? 'bg-yellow-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.date ? dateFormatter.format(new Date(transaction.date)) : '--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{transaction.payee || 'Unknown payee'}</div>
                      <div className="text-xs text-gray-500">{transaction.description || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{accountName}</div>
                      {transferName && (
                        <div className="mt-1 text-xs text-gray-500">
                          Transfer: {accountName} → {transferName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {transaction.reviewed ? (
                        <div>
                          <div className="font-medium text-gray-900">
                            {transaction.category?.name || 'Uncategorized'}
                          </div>
                          {transaction.category?.section && (
                            <div className="text-xs text-gray-500">{transaction.category.section}</div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-blue-600">
                            {transaction.ai_suggested?.name || 'Needs categorization'}
                          </div>
                          {transaction.ai_confidence && (
                            <div className="text-xs text-gray-500">
                              {Math.round(transaction.ai_confidence * 100)}% confidence
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {currencyFormatter.format(Math.abs(transaction.amount || 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center gap-2">
                        {transaction.is_transfer && (
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            Transfer
                          </span>
                        )}
                        {transaction.reviewed ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            Reviewed
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            Pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {!transaction.reviewed && transaction.ai_suggested_category && (
                        <button
                          onClick={() => handleApprove(transaction.id, transaction.ai_suggested_category)}
                          disabled={processing === transaction.id}
                          className="text-primary-600 hover:text-primary-900 disabled:opacity-50"
                        >
                          {processing === transaction.id ? 'Approving...' : 'Approve'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
