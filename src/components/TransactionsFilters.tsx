'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const RANGE_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
]

const REVIEW_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Reviewed' },
  { value: 'false', label: 'Unreviewed' },
]

export default function TransactionsFilters({
  reviewed,
  range,
  startDate,
  endDate,
  lastUpdated,
  accounts,
  accountId,
  query,
}: {
  reviewed?: string
  range: string
  startDate?: string
  endDate?: string
  lastUpdated: string
  accounts: Array<{ id: string; name: string; institution?: string | null }>
  accountId?: string
  query?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [customStart, setCustomStart] = useState(startDate || '')
  const [customEnd, setCustomEnd] = useState(endDate || '')
  const [searchValue, setSearchValue] = useState(query || '')

  useEffect(() => {
    if (range === 'custom') {
      setCustomStart(startDate || '')
      setCustomEnd(endDate || '')
    }
  }, [range, startDate, endDate])

  useEffect(() => {
    setSearchValue(query || '')
  }, [query])

  useEffect(() => {
    const trimmed = searchValue.trim()
    if (trimmed === (query || '')) {
      return
    }

    const handler = window.setTimeout(() => {
      updateParams({ q: trimmed.length > 0 ? trimmed : null })
    }, 400)

    return () => window.clearTimeout(handler)
  }, [searchValue, query])

  const activeReviewed = reviewed ?? 'all'

  const filterSummary = useMemo(() => {
    const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? 'This Month'
    const reviewLabel = REVIEW_OPTIONS.find((option) => option.value === activeReviewed)?.label ?? 'All'
    return `${rangeLabel} · ${reviewLabel}`
  }, [range, activeReviewed])

  const activeChips = useMemo(() => {
    const chips: string[] = []
    if (accountId) {
      const accountLabel = accounts.find((account) => account.id === accountId)?.name
      if (accountLabel) chips.push(`Account: ${accountLabel}`)
    }
    if (range) {
      const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label
      if (rangeLabel) chips.push(`Range: ${rangeLabel}`)
    }
    if (activeReviewed && activeReviewed !== 'all') {
      const reviewLabel = REVIEW_OPTIONS.find((option) => option.value === activeReviewed)?.label
      if (reviewLabel) chips.push(`Status: ${reviewLabel}`)
    }
    if (query) {
      chips.push(`Search: ${query}`)
    }
    return chips
  }, [accountId, accounts, range, activeReviewed, query])

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

  const handleReviewChange = (value: string) => {
    updateParams({ reviewed: value })
  }

  const handleAccountChange = (value: string) => {
    updateParams({ account_id: value })
  }

  const clearFilters = () => {
    updateParams({
      range: 'last_3_months',
      reviewed: 'false',
      start: null,
      end: null,
      q: null,
    })
    setSearchValue('')
  }

  const applyCustomRange = () => {
    updateParams({ range: 'custom', start: customStart, end: customEnd })
  }

  return (
    <div className="card space-y-4 sticky top-20 z-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Filters</p>
          <p className="text-xs text-slate-500">{filterSummary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="btn-secondary"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="btn-ghost"
          >
            Clear filters
          </button>
          <span className="text-xs text-slate-500">Updated {lastUpdated}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.4fr)] lg:items-center">
        <div className="space-y-2">
          <label className="label" htmlFor="account-filter">
            Account
          </label>
          <select
            id="account-filter"
            value={accountId || ''}
            onChange={(event) => handleAccountChange(event.target.value)}
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
        <div className="space-y-2">
          <label className="label" htmlFor="transaction-search">
            Search
          </label>
          <div className="relative">
            <input
              id="transaction-search"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search payee, description, or reference"
              className="input w-full pr-10"
              aria-label="Search transactions"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
        <div className="flex flex-wrap gap-2">
          {REVIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleReviewChange(option.value)}
              className={`pill ${activeReviewed === option.value ? 'pill-active' : 'pill-inactive'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <span key={chip} className="badge badge-slate">
              {chip}
            </span>
          ))}
        </div>
      )}

      {range === 'custom' && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="custom-start">
              Start date
            </label>
            <input
              id="custom-start"
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              className="input w-full"
            />
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="custom-end">
              End date
            </label>
            <input
              id="custom-end"
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
