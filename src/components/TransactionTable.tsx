'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconCheck, IconClipboard } from '@/components/ui/icons'
import { apiRequest } from '@/lib/api-client'
import { getCategoryDisplayLabel, NEEDS_CATEGORIZATION_LABEL } from '@/lib/transactions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default function TransactionTable({
  transactions,
  filterSummary,
  allTimeHref = '/transactions?range=all',
  categories,
  accountId,
}: {
  transactions: any[]
  filterSummary: string
  allTimeHref?: string
  categories: Array<{ id: string; name: string; section?: string | null }>
  accountId: string
}) {
  const [processing, setProcessing] = useState<string | null>(null)
  const [openCategoryFor, setOpenCategoryFor] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    setSelectedIds([])
  }, [transactions])

  const allSelected = useMemo(() => {
    return transactions.length > 0 && selectedIds.length === transactions.length
  }, [transactions.length, selectedIds.length])

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
      return
    }
    setSelectedIds(transactions.map((transaction) => transaction.id))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleApprove = async ({
    transactionId,
    categoryId,
    markReviewed,
  }: {
    transactionId: string
    categoryId?: string | null
    markReviewed?: boolean
  }) => {
    setProcessing(transactionId)

    try {
      const payload: Record<string, unknown> = {
        markReviewed: markReviewed ?? true,
      }
      if (categoryId !== undefined) {
        payload.categoryId = categoryId
      }

      await apiRequest(`/api/transactions/${transactionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setOpenCategoryFor(null)
      setSelectedCategoryId('')
      toast({
        variant: 'success',
        title: 'Transaction updated',
        description: 'The transaction was updated successfully.',
      })
      router.refresh()
    } catch (error) {
      console.error('Approve request failed', error)
      const errorText = error instanceof Error ? error.message : 'Failed to approve transaction.'
      toast({
        variant: 'error',
        title: 'Approval failed',
        description: errorText,
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleBulkAction = async (action: 'mark_reviewed' | 'set_category' | 'approve') => {
    if (selectedIds.length === 0) return

    if (action === 'set_category' && !bulkCategoryId) {
      toast({
        variant: 'info',
        title: 'Select a category',
        description: 'Choose a category before applying bulk updates.',
      })
      return
    }

    setBulkProcessing(true)

    try {
      await apiRequest('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          categoryId: action === 'set_category' ? bulkCategoryId : undefined,
        }),
      })

      setSelectedIds([])
      setBulkCategoryId('')
      toast({
        variant: 'success',
        title: 'Bulk update complete',
        description: 'Selected transactions were updated.',
      })
      router.refresh()
    } catch (error) {
      console.error('Bulk update failed', error)
      const errorText = error instanceof Error ? error.message : 'Bulk update failed.'
      toast({
        variant: 'error',
        title: 'Bulk update failed',
        description: errorText,
      })
    } finally {
      setBulkProcessing(false)
    }
  }

  if (transactions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <IconClipboard className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold text-slate-900">No transactions found</p>
        <p className="mt-2 text-sm text-slate-500">
          Try expanding the date range, switching accounts, or uploading a file.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <span>Active filters: {filterSummary}</span>
          <a href={allTimeHref} className="font-semibold text-slate-700 hover:text-slate-900">
            View all time
          </a>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      {selectedIds.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedIds.length} selected
              </p>
              <p className="text-xs text-slate-500">Bulk actions apply to selected rows.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkAction('mark_reviewed')}
                disabled={bulkProcessing}
              >
                Mark reviewed
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={bulkCategoryId}
                  onChange={(event) => setBulkCategoryId(event.target.value)}
                  className="h-9 w-48 text-xs"
                  aria-label="Select bulk category"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.section ? `${category.section} · ${category.name}` : category.name}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleBulkAction('set_category')}
                  disabled={bulkProcessing || !bulkCategoryId}
                >
                  Apply category
                </Button>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleBulkAction('approve')}
                disabled={bulkProcessing}
              >
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Transactions</h2>
          <p className="text-xs text-slate-500">
            Showing {transactions.length} · {filterSummary}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Account scoped</span>
          <Badge>{accountId ? 'Active' : 'None'}</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all transactions"
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const isReviewed =
                Boolean(transaction.reviewed) || transaction.review_status === 'approved'
              const isPositive = transaction.amount >= 0
              const accountName = transaction.account?.name || 'Unassigned'
              const transferName = transaction.transfer_to_account?.name
              const suggestedCategoryId =
                transaction.primary_category_id ||
                transaction.category_id ||
                transaction.ai_suggested_category ||
                transaction.ai_suggested?.id ||
                null
              const resolvedCategory =
                transaction.primary_category ||
                transaction.category ||
                transaction.subcategory ||
                null
              const categoryName = getCategoryDisplayLabel(transaction)
              const categorySection = resolvedCategory?.section || null
              const needsCategorization = categoryName === NEEDS_CATEGORIZATION_LABEL
              const isCategoryPickerOpen = openCategoryFor === transaction.id
              return (
                <TableRow
                  key={transaction.id}
                  className={`${
                    !isReviewed ? 'bg-amber-50/40' : ''
                  } focus-within:bg-slate-50`}
                >
                  <TableCell className="align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(transaction.id)}
                      onChange={() => toggleSelect(transaction.id)}
                      aria-label={`Select transaction ${transaction.payee}`}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-900">
                    {transaction.date ? dateFormatter.format(new Date(transaction.date)) : '--'}
                  </TableCell>
                  <TableCell className="text-slate-900">
                    <div className="font-medium">
                      {transaction.payee_display || transaction.payee || 'Unknown payee'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {transaction.description || 'No description'}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-900">
                    <div className="font-medium">{accountName}</div>
                    {transferName && (
                      <div className="mt-1 text-xs text-slate-500">
                        Transfer: {accountName} to {transferName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {isReviewed ? (
                      <div>
                        <div className="font-medium text-slate-900">{categoryName}</div>
                        {categorySection && !needsCategorization && (
                          <div className="text-xs text-slate-500">
                            {categorySection}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {transaction.ai_suggested?.name ? (
                          <div className="font-medium text-slate-900">
                            {transaction.ai_suggested.name}
                            <span className="ml-2 text-xs text-slate-500">AI suggested</span>
                          </div>
                        ) : !needsCategorization ? (
                          <div className="font-medium text-slate-900">{categoryName}</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenCategoryFor(transaction.id)
                              setSelectedCategoryId('')
                            }}
                            className="text-left font-medium text-slate-700 hover:text-slate-900"
                          >
                            Needs categorization
                          </button>
                        )}
                        {transaction.ai_confidence && (
                          <div className="mt-2">
                            <Badge variant="info">
                              AI {Math.round(transaction.ai_confidence * 100)}% confidence
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    className={`whitespace-nowrap text-right font-semibold ${
                      isPositive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {currencyFormatter.format(Math.abs(transaction.amount || 0))}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    <div className="flex flex-col items-center gap-2">
                      {transaction.is_transfer && <Badge variant="info">Transfer</Badge>}
                      {isReviewed ? (
                        <Badge variant="success">Reviewed</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium">
                    {!isReviewed && (
                      <div className="flex flex-col items-end gap-2">
                        {isCategoryPickerOpen ? (
                          <div className="flex flex-col items-end gap-2">
                            <Select
                              value={selectedCategoryId}
                              onChange={(event) => setSelectedCategoryId(event.target.value)}
                              className="h-9 w-48 text-xs"
                            >
                              <option value="">Select category</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.section ? `${category.section} · ${category.name}` : category.name}
                                </option>
                              ))}
                            </Select>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() =>
                                  handleApprove({
                                    transactionId: transaction.id,
                                    categoryId: selectedCategoryId || null,
                                  })
                                }
                                disabled={processing === transaction.id || selectedCategoryId.length === 0}
                                className="text-xs"
                              >
                                {processing === transaction.id ? 'Approving...' : 'Approve'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setOpenCategoryFor(null)
                                  setSelectedCategoryId('')
                                }}
                                className="text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              if (suggestedCategoryId) {
                                void handleApprove({
                                  transactionId: transaction.id,
                                  categoryId: suggestedCategoryId,
                                })
                                return
                              }
                              setOpenCategoryFor(transaction.id)
                              setSelectedCategoryId('')
                            }}
                            disabled={processing === transaction.id}
                            className="text-xs"
                          >
                            {processing === transaction.id
                              ? 'Approving...'
                              : suggestedCategoryId
                                ? 'Approve'
                                : 'Categorize + Approve'}
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleApprove({
                              transactionId: transaction.id,
                              markReviewed: true,
                            })
                          }
                          disabled={processing === transaction.id}
                          className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
                        >
                          Mark reviewed
                        </button>
                      </div>
                    )}
                    {isReviewed && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        <IconCheck className="h-3.5 w-3.5" />
                        Approved
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
