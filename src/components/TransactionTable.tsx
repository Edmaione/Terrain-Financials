'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconCheck, IconClipboard } from '@/components/ui/icons'
import { apiRequest } from '@/lib/api-client'
import { getCategoryDisplayLabel, NEEDS_CATEGORIZATION_LABEL } from '@/lib/transactions'
import { Badge } from '@/design-system/components/Badge'
import { Button } from '@/design-system/components/Button'
import { Card } from '@/design-system/components/Card'
import { EmptyState } from '@/design-system/components/EmptyState'
import { Select } from '@/design-system/components/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { colors, spacing, typography } from '@/design-system/tokens'
import { tokenVar } from '@/design-system/utils'

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
      <Card padding={12}>
        <EmptyState
          title="No transactions found"
          description="Try expanding the date range, switching accounts, or uploading a file."
          icon={<IconClipboard className="h-6 w-6" />}
          action={(
            <div
              className="flex flex-wrap items-center justify-center"
              style={{
                gap: spacing[2],
                fontSize: typography.sizes.xs,
                color: tokenVar('gray-500', colors.gray[500]),
              }}
            >
              <span>Active filters: {filterSummary}</span>
              <a
                href={allTimeHref}
                className="font-semibold"
                style={{ color: tokenVar('gray-700', colors.gray[700]) }}
              >
                View all time
              </a>
            </div>
          )}
        />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden" padding="none">
      {selectedIds.length > 0 && (
        <div
          className="border-b"
          style={{
            borderColor: tokenVar('gray-200', colors.gray[200]),
            backgroundColor: tokenVar('gray-100', colors.gray[100]),
            padding: `${spacing[4]} ${spacing[5]}`,
          }}
        >
          <div
            className="flex flex-col lg:flex-row lg:items-center lg:justify-between"
            style={{ gap: spacing[3] }}
          >
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: tokenVar('gray-900', colors.gray[900]) }}
              >
                {selectedIds.length} selected
              </p>
              <p
                className="text-xs"
                style={{ color: tokenVar('gray-500', colors.gray[500]) }}
              >
                Bulk actions apply to selected rows.
              </p>
            </div>
            <div className="flex flex-wrap items-center" style={{ gap: spacing[2] }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkAction('mark_reviewed')}
                disabled={bulkProcessing}
              >
                Mark reviewed
              </Button>
              <div className="flex flex-wrap items-center" style={{ gap: spacing[2] }}>
                <Select
                  value={bulkCategoryId}
                  onChange={(event) => setBulkCategoryId(event.target.value)}
                  className="w-48"
                  style={{ height: spacing[10] }}
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

      <div
        className="flex flex-col border-b lg:flex-row lg:items-center lg:justify-between"
        style={{
          gap: spacing[4],
          borderColor: tokenVar('gray-200', colors.gray[200]),
          backgroundColor: tokenVar('gray-50', colors.gray[50]),
          padding: `${spacing[4]} ${spacing[5]}`,
        }}
      >
        <div>
          <h2
            className="text-xl font-semibold"
            style={{ color: tokenVar('gray-900', colors.gray[900]) }}
          >
            Transactions
          </h2>
          <p className="text-xs" style={{ color: tokenVar('gray-500', colors.gray[500]) }}>
            Showing {transactions.length} · {filterSummary}
          </p>
        </div>
        <div
          className="flex items-center text-xs"
          style={{ gap: spacing[2], color: tokenVar('gray-500', colors.gray[500]) }}
        >
          <span>Account scoped</span>
          <Badge variant={accountId ? 'success' : 'neutral'}>
            {accountId ? 'Active' : 'None'}
          </Badge>
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
                  className="focus-within:bg-[var(--ds-row-focus)]"
                  style={{
                    backgroundColor: !isReviewed
                      ? tokenVar('warning-soft', colors.gray[100])
                      : undefined,
                    ['--ds-row-focus' as string]: tokenVar('gray-100', colors.gray[100]),
                  }}
                >
                  <TableCell className="align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(transaction.id)}
                      onChange={() => toggleSelect(transaction.id)}
                      aria-label={`Select transaction ${transaction.payee}`}
                    />
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap"
                    style={{ color: tokenVar('gray-900', colors.gray[900]) }}
                  >
                    {transaction.date ? dateFormatter.format(new Date(transaction.date)) : '--'}
                  </TableCell>
                  <TableCell style={{ color: tokenVar('gray-900', colors.gray[900]) }}>
                    <div className="font-medium">
                      {transaction.payee_display || transaction.payee || 'Unknown payee'}
                    </div>
                    <div className="text-xs" style={{ color: tokenVar('gray-500', colors.gray[500]) }}>
                      {transaction.description || 'No description'}
                    </div>
                  </TableCell>
                  <TableCell style={{ color: tokenVar('gray-900', colors.gray[900]) }}>
                    <div className="font-medium">{accountName}</div>
                    {transferName && (
                      <div
                        className="mt-1 text-xs"
                        style={{ color: tokenVar('gray-500', colors.gray[500]) }}
                      >
                        Transfer: {accountName} to {transferName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {isReviewed ? (
                      <div>
                        <div
                          className="font-medium"
                          style={{ color: tokenVar('gray-900', colors.gray[900]) }}
                        >
                          {categoryName}
                        </div>
                        {categorySection && !needsCategorization && (
                          <div
                            className="text-xs"
                            style={{ color: tokenVar('gray-500', colors.gray[500]) }}
                          >
                            {categorySection}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {transaction.ai_suggested?.name ? (
                          <div
                            className="font-medium"
                            style={{ color: tokenVar('gray-900', colors.gray[900]) }}
                          >
                            {transaction.ai_suggested.name}
                            <span
                              className="ml-2 text-xs"
                              style={{ color: tokenVar('gray-500', colors.gray[500]) }}
                            >
                              AI suggested
                            </span>
                          </div>
                        ) : !needsCategorization ? (
                          <div
                            className="font-medium"
                            style={{ color: tokenVar('gray-900', colors.gray[900]) }}
                          >
                            {categoryName}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenCategoryFor(transaction.id)
                              setSelectedCategoryId('')
                            }}
                            className="text-left font-medium hover:text-[var(--ds-category-hover)]"
                            style={{
                              color: tokenVar('gray-700', colors.gray[700]),
                              ['--ds-category-hover' as string]: tokenVar('gray-900', colors.gray[900]),
                            }}
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
                    className="whitespace-nowrap text-right font-semibold"
                    style={{
                      color: isPositive
                        ? tokenVar('success', colors.success)
                        : tokenVar('error', colors.error),
                    }}
                  >
                    {isPositive ? '+' : ''}
                    {currencyFormatter.format(Math.abs(transaction.amount || 0))}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    <div className="flex flex-col items-center" style={{ gap: spacing[2] }}>
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
                      <div className="flex flex-col items-end" style={{ gap: spacing[2] }}>
                        {isCategoryPickerOpen ? (
                          <div className="flex flex-col items-end" style={{ gap: spacing[2] }}>
                            <Select
                              value={selectedCategoryId}
                              onChange={(event) => setSelectedCategoryId(event.target.value)}
                              className="w-48"
                              style={{ height: spacing[10] }}
                            >
                              <option value="">Select category</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.section ? `${category.section} · ${category.name}` : category.name}
                                </option>
                              ))}
                            </Select>
                            <div className="flex items-center" style={{ gap: spacing[2] }}>
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
                          className="text-xs hover:text-[var(--ds-review-hover)] disabled:opacity-50"
                          style={{
                            color: tokenVar('gray-500', colors.gray[500]),
                            ['--ds-review-hover' as string]: tokenVar('gray-700', colors.gray[700]),
                          }}
                        >
                          Mark reviewed
                        </button>
                      </div>
                    )}
                    {isReviewed && (
                      <Badge
                        variant="success"
                        className="inline-flex items-center"
                        style={{ gap: spacing[1] }}
                      >
                        <IconCheck className="h-3.5 w-3.5" />
                        Approved
                      </Badge>
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
