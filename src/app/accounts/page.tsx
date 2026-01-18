'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import AccountForm, { AccountFormValues } from '@/components/AccountForm'
import { apiRequest } from '@/lib/api-client'
import { AccountType } from '@/types'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Badge } from '@/design-system/components/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

type AccountRecord = {
  id: string
  name: string
  type: AccountType
  institution?: string | null
  account_number?: string | null
  is_active: boolean
  opening_balance: number
  current_balance: number
  notes?: string | null
  display_order?: number | null
}

type AccountFormErrors = Partial<Record<'name' | 'type', string>>

const emptyForm: AccountFormValues = {
  name: '',
  type: '',
  institution: '',
  account_number: '',
  opening_balance: 0,
  notes: '',
  is_active: true,
}

const typeLabels: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit card',
  loan: 'Loan',
  investment: 'Investment',
}

const typeBadgeVariant: Record<AccountType, 'info' | 'success' | 'warning' | 'error' | 'neutral'> = {
  checking: 'info',
  savings: 'success',
  credit_card: 'warning',
  loan: 'error',
  investment: 'neutral',
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountRecord | null>(null)
  const [formState, setFormState] = useState<AccountFormValues>({ ...emptyForm })
  const [formErrors, setFormErrors] = useState<AccountFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AccountRecord | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const activeCount = useMemo(
    () => accounts.filter((account) => account.is_active).length,
    [accounts]
  )

  const fetchAccounts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<AccountRecord[]>('/api/accounts')
      setAccounts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAccounts()
  }, [])

  const openCreateModal = () => {
    setEditingAccount(null)
    setFormState({ ...emptyForm })
    setFormErrors({})
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (account: AccountRecord) => {
    setEditingAccount(account)
    setFormState({
      name: account.name ?? '',
      type: account.type ?? '',
      institution: account.institution ?? '',
      account_number: account.account_number ?? '',
      opening_balance: account.opening_balance ?? 0,
      notes: account.notes ?? '',
      is_active: account.is_active,
    })
    setFormErrors({})
    setFormError(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setFormError(null)
    setFormErrors({})
  }

  const validateForm = () => {
    const errors: AccountFormErrors = {}
    if (!formState.name.trim()) {
      errors.name = 'Name is required.'
    }
    if (!formState.type) {
      errors.type = 'Type is required.'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }
    setIsSaving(true)
    setFormError(null)
    try {
      const payload = {
        name: formState.name.trim(),
        type: formState.type,
        institution: formState.institution.trim() || null,
        account_number: formState.account_number.trim() || null,
        opening_balance: formState.opening_balance ?? 0,
        notes: formState.notes.trim() || null,
        is_active: formState.is_active,
      }

      if (editingAccount) {
        await apiRequest<AccountRecord>(`/api/accounts/${editingAccount.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await apiRequest<AccountRecord>('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      await fetchAccounts()
      setIsModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save account.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    try {
      await apiRequest(`/api/accounts/${deleteTarget.id}`, { method: 'DELETE' })
      await fetchAccounts()
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to deactivate account.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        label="Accounts"
        title="Account management"
        description="View balances, manage account metadata, and keep statuses up to date."
      />

      <Card className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Accounts</h3>
            <p className="text-sm text-slate-500">
              {activeCount} active account{activeCount === 1 ? '' : 's'} · {accounts.length} total
            </p>
          </div>
          <Button size="sm" onClick={openCreateModal}>
            New account
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            Loading accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            No accounts yet. Create your first account to get started.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Last 4 digits</TableHead>
                  <TableHead className="text-right">Current balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="text-slate-900">
                      <div className="font-medium">{account.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant[account.type]} size="sm">
                        {typeLabels[account.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {account.institution || '—'}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {account.account_number ? account.account_number.slice(-4) : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        account.current_balance >= 0 ? 'text-slate-900' : 'text-rose-600'
                      }`}
                    >
                      {currencyFormatter.format(account.current_balance ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? 'success' : 'neutral'} size="sm">
                        {account.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(account)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(account)}
                          disabled={!account.is_active}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingAccount ? 'Edit account' : 'New account'}
                </h3>
                <p className="text-sm text-slate-500">
                  {editingAccount
                    ? 'Update the account details, type, and status.'
                    : 'Create a new account for tracking balances.'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Close
              </Button>
            </div>

            <div className="mt-6">
              <AccountForm value={formState} onChange={setFormState} errors={formErrors} />
            </div>

            {formError && <p className="mt-4 text-sm text-rose-600">{formError}</p>}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} loading={isSaving}>
                {editingAccount ? 'Save changes' : 'Create account'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-900">Deactivate account</h3>
            <p className="mt-2 text-sm text-slate-500">
              This will mark <span className="font-semibold text-slate-700">{deleteTarget.name}</span>{' '}
              as inactive. Transactions remain intact.
            </p>
            {deleteError && <p className="mt-3 text-sm text-rose-600">{deleteError}</p>}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDelete}>
                Deactivate account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
