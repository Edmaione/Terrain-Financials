'use client'

import { Input } from '@/design-system/components/Input'
import { Select } from '@/design-system/components/Select'
import { AccountType } from '@/types'

export type AccountFormValues = {
  name: string
  type: AccountType | ''
  institution: string
  account_number: string
  opening_balance: number
  notes: string
  is_active: boolean
}

type AccountFormErrors = Partial<Record<'name' | 'type', string>>

interface AccountFormProps {
  value: AccountFormValues
  onChange: (value: AccountFormValues) => void
  errors?: AccountFormErrors
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'loan', label: 'Loan' },
]

export default function AccountForm({ value, onChange, errors }: AccountFormProps) {
  const updateField = <K extends keyof AccountFormValues>(
    key: K,
    fieldValue: AccountFormValues[K]
  ) => {
    onChange({ ...value, [key]: fieldValue })
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          htmlFor="account-name"
        >
          Name *
        </label>
        <Input
          id="account-name"
          value={value.name}
          onChange={(event) => updateField('name', event.target.value)}
          placeholder="e.g. Operating Checking"
          state={errors?.name ? 'error' : 'default'}
        />
        {errors?.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
      </div>
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          htmlFor="account-type"
        >
          Type *
        </label>
        <Select
          id="account-type"
          value={value.type}
          onChange={(event) =>
            updateField('type', event.target.value ? (event.target.value as AccountType) : '')
          }
          state={errors?.type ? 'error' : 'default'}
        >
          <option value="">Select type</option>
          {ACCOUNT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {errors?.type && <p className="mt-1 text-xs text-rose-600">{errors.type}</p>}
      </div>
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          htmlFor="account-institution"
        >
          Institution
        </label>
        <Input
          id="account-institution"
          value={value.institution}
          onChange={(event) => updateField('institution', event.target.value)}
          placeholder="e.g. Chase Bank"
        />
      </div>
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          htmlFor="account-number"
        >
          Account number (last 4)
        </label>
        <Input
          id="account-number"
          value={value.account_number}
          onChange={(event) => updateField('account_number', event.target.value)}
          placeholder="1234"
        />
      </div>
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          htmlFor="account-opening"
        >
          Opening balance
        </label>
        <Input
          id="account-opening"
          type="number"
          value={Number.isFinite(value.opening_balance) ? value.opening_balance : 0}
          readOnly
          disabled
        />
        <p className="mt-1 text-xs text-slate-500">
          Opening balance is tracked on creation and cannot be edited here.
        </p>
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={value.is_active}
            onChange={(event) => updateField('is_active', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          Active account
        </label>
      </div>
      <div className="md:col-span-2">
        <label
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          htmlFor="account-notes"
        >
          Notes
        </label>
        <textarea
          id="account-notes"
          value={value.notes}
          onChange={(event) => updateField('notes', event.target.value)}
          placeholder="Optional notes about this account"
          className="min-h-[96px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
        />
      </div>
    </div>
  )
}
