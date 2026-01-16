'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const RANGE_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
]

export default function ReportsFilters({
  range,
  startDate,
  endDate,
  accounts,
  accountId,
}: {
  range: string
  startDate: string
  endDate: string
  accounts: Array<{ id: string; name: string; institution?: string | null }>
  accountId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [customStart, setCustomStart] = useState(startDate || '')
  const [customEnd, setCustomEnd] = useState(endDate || '')

  useEffect(() => {
    if (range === 'custom') {
      setCustomStart(startDate || '')
      setCustomEnd(endDate || '')
    }
  }, [range, startDate, endDate])

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    router.push(`${pathname}?${params.toString()}`)
  }

  const handleRangeChange = (value: string) => {
    if (value !== 'custom') {
      updateParams({ range: value, start: null, end: null })
      return
    }

    updateParams({ range: value })
  }

  const applyCustomRange = () => {
    updateParams({ range: 'custom', start: customStart, end: customEnd })
  }

  return (
    <div className="card space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(240px,1fr)]">
        <div>
          <label className="label" htmlFor="reports-account">
            Account
          </label>
          <select
            id="reports-account"
            value={accountId || ''}
            onChange={(event) => updateParams({ account_id: event.target.value })}
            className="input w-full"
            aria-label="Select account"
          >
            {accounts.length === 0 && <option value="">No accounts</option>}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.institution ? ` · ${account.institution}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="reports-range">
            Range
          </label>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleRangeChange(option.value)}
                className={`pill ${range === option.value ? 'pill-active' : 'pill-inactive'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="reports-start">
              Start date
            </label>
            <input
              id="reports-start"
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              className="input w-full"
            />
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="reports-end">
              End date
            </label>
            <input
              id="reports-end"
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              className="input w-full"
            />
          </div>
          <button
            type="button"
            onClick={applyCustomRange}
            className="btn-primary"
            disabled={!customStart || !customEnd}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
