'use client'

import { useState } from 'react'

export default function TransactionTable({ transactions }: { transactions: any[] }) {
  const [processing, setProcessing] = useState<string | null>(null)
  
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
        <p className="text-gray-500">No transactions found</p>
      </div>
    )
  }
  
  return (
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
            {transactions.map((transaction) => (
              <tr key={transaction.id} className={!transaction.reviewed ? 'bg-yellow-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(transaction.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="font-medium">{transaction.payee}</div>
                  {transaction.account && (
                    <div className="text-xs text-gray-500">{transaction.account.name}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {transaction.description || '-'}
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
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                  transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
