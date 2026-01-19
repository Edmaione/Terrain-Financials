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
  accounts,
  accountId,
}: {
  transactions: any[]
  filterSummary: string
  allTimeHref?: string
  categories: Array<{ id: string; name: string; section?: string | null }>
  accounts: Array<{ id: string; name: string; institution?: string | null }>
  accountId?: string
}) {
  const [processing, setProcessing] = useState<string | null>(null)
  const [openCategoryFor, setOpenCategoryFor] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [bulkAccountId, setBulkAccountId] = useState<string>('')
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [accountProcessingId, setAccountProcessingId] = useState<string | null>(null)
  const [accountOverrides, setAccountOverrides] = useState<Record<string, string>>({})
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    setSelectedIds([])
    setAccountOverrides({})
  }, [transactions])

  const allSelected = useMemo(() => {
    return transactions.length > 0 && selectedIds.length === transactions.length
  }, [transactions.length, selectedIds.length])

  const accountsById = useMemo(() => {
    return new Map(accounts.map((account) => [account.id, account]))
  }, [accounts])

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

      if (categoryId) {
        await apiRequest(`/api/transactions/${transactionId}/categorize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: categoryId }),
        })
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

  const handleBulkAction = async (
    action:
      | 'mark_reviewed'
      | 'set_category'
      | 'approve'
      | 'set_account'
      | 'mark_cleared'
      | 'mark_reconciled'
      | 'mark_unreconciled'
      | 'soft_delete'
      | 'restore'
  ) => {
    if (selectedIds.length === 0) return

    if (action === 'set_category' && !bulkCategoryId) {
      toast({
        variant: 'info',
        title: 'Select a category',
        description: 'Choose a category before applying bulk updates.',
      })
      return
    }

    if (action === 'set_account' && !bulkAccountId) {
      toast({
        variant: 'info',
        title: 'Select an account',
        description: 'Choose an account before applying bulk updates.',
      })
      return
    }

    if (action === 'soft_delete') {
      const confirmed = window.confirm(
        `Soft delete ${selectedIds.length} selected transaction(s)? You can restore them later.`
      )
      if (!confirmed) return
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
          accountId: action === 'set_account' ? bulkAccountId : undefined,
        }),
      })

      setSelectedIds([])
      setBulkCategoryId('')
      setBulkAccountId('')
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

  const handleAccountUpdate = async (transactionId: string, nextAccountId: string) => {
    if (!nextAccountId) {
      toast({
        variant: 'error',
        title: 'Account required',
        description: 'Select a bank account before saving.',
      })
      return
    }

    const previousAccountId = accountOverrides[transactionId]
    setAccountOverrides((prev) => ({ ...prev, [transactionId]: nextAccountId }))
    setAccountProcessingId(transactionId)

    try {
      await apiRequest(`/api/transactions/${transactionId}/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: nextAccountId }),
      })
      toast({
        variant: 'success',
        title: 'Account updated',
        description: 'Transaction account updated successfully.',
      })
      router.refresh()
    } catch (error) {
      console.error('Account update failed', error)
      setAccountOverrides((prev) => {
        if (previousAccountId === undefined) {
          const { [transactionId]: _, ...rest } = prev
          return rest
        }
        return { ...prev, [transactionId]: previousAccountId }
      })
      toast({
        variant: 'error',
        title: 'Account update failed',
        description: error instanceof Error ? error.message : 'Failed to update account.',
      })
    } finally {
      setAccountProcessingId(null)
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
              <div className="flex flex-wrap items-center" style={{ gap: spacing[2] }}>
                <Select
                  value={bulkAccountId}
                  onChange={(event) => setBulkAccountId(event.target.value)}
                  className="w-48"
                  style={{ height: spacing[10] }}
                  aria-label="Select bulk account"
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                      {account.institution ? ` · ${account.institution}` : ''}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleBulkAction('set_account')}
                  disabled={bulkProcessing || !bulkAccountId}
                >
                  Apply account
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkAction('mark_cleared')}
                disabled={bulkProcessing}
              >
                Mark cleared
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkAction('mark_reconciled')}
                disabled={bulkProcessing}
              >
                Mark reconciled
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkAction('mark_unreconciled')}
                disabled={bulkProcessing}
              >
                Mark unreconciled
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBulkAction('restore')}
                disabled={bulkProcessing}
              >
                Restore
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBulkAction('soft_delete')}
                disabled={bulkProcessing}
                className="text-rose-600"
              >
                Soft delete
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
          <span>Account scope</span>
          <Badge variant={accountId ? 'success' : 'neutral'}>
            {accountId ? 'Filtered' : 'All accounts'}
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
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead>From/To</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const isReviewed = transaction.review_status === 'approved'
              const amount = transaction.amount ?? 0
              const isPositive = amount >= 0
              const accountIdValue =
                accountOverrides[transaction.id] ?? transaction.account_id ?? ''
              const accountName =
                (accountIdValue && accountsById.get(accountIdValue)?.name) ||
                transaction.accounts?.name ||
                'Unassigned'
              const transferName = transaction.transfer_to_account?.name || null
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
              const spentAmount = amount < 0 ? Math.abs(amount) : 0
              const receivedAmount = amount > 0 ? amount : 0
              const fromTo =
                transaction.customer?.name ||
                transaction.vendor?.name ||
                (transferName
                  ? `${isPositive ? 'From' : 'To'} ${transferName}`
                  : transaction.payee_display || transaction.payee || '—')
              const bankStatus = transaction.bank_status ?? 'posted'
              const reconciliationStatus = transaction.reconciliation_status ?? 'unreconciled'
              const isVoided = Boolean(transaction.voided_at)
              const isDeleted = Boolean(transaction.deleted_at)
              const hasRule = Boolean(transaction.applied_rule_id)
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
                    <Select
                      value={accountIdValue}
                      onChange={(event) =>
                        handleAccountUpdate(transaction.id, event.target.value)
                      }
                      className="w-48"
                      style={{ height: spacing[10] }}
                      aria-label={`Select account for ${transaction.payee}`}
                      disabled={accountProcessingId === transaction.id}
                    >
                      <option value="" disabled>
                        Unassigned
                      </option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                          {account.institution ? ` · ${account.institution}` : ''}
                        </option>
                      ))}
                    </Select>
                    {transferName && (
                      <div
                        className="mt-1 text-xs"
                        style={{ color: tokenVar('gray-500', colors.gray[500]) }}
                      >
                        Transfer: {accountName} to {transferName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap text-right font-semibold"
                    style={{
                      color: tokenVar('error', colors.error),
                    }}
                  >
                    {spentAmount > 0 ? currencyFormatter.format(spentAmount) : '—'}
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap text-right font-semibold"
                    style={{
                      color: tokenVar('success', colors.success),
                    }}
                  >
                    {receivedAmount > 0 ? currencyFormatter.format(receivedAmount) : '—'}
                  </TableCell>
                  <TableCell className="text-sm" style={{ color: tokenVar('gray-700', colors.gray[700]) }}>
                    {fromTo}
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
                  <TableCell className="whitespace-nowrap text-center">
                    <div className="flex flex-col items-center" style={{ gap: spacing[2] }}>
                      {transaction.is_transfer && <Badge variant="info">PAIRED</Badge>}
                      {isDeleted && <Badge variant="error">Deleted</Badge>}
                      {isVoided && !isDeleted && <Badge variant="warning">Voided</Badge>}
                      {!isVoided && !isDeleted && bankStatus === 'pending' && (
                        <Badge variant="warning">Pending</Badge>
                      )}
                      {!isVoided && !isDeleted && bankStatus === 'posted' && (
                        <Badge variant="success">Posted</Badge>
                      )}
                      {!isVoided && !isDeleted && reconciliationStatus === 'cleared' && (
                        <Badge variant="info">Cleared</Badge>
                      )}
                      {!isVoided && !isDeleted && reconciliationStatus === 'reconciled' && (
                        <Badge variant="neutral">Reconciled</Badge>
                      )}
                      {hasRule && <Badge variant="neutral">Rule</Badge>}
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
