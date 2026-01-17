'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { IconFilter, IconRefresh, IconX } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All time' },
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
  const debugDataFlow = process.env.NEXT_PUBLIC_DEBUG_DATA_FLOW === 'true'

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
    const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? 'This month'
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

    if (debugDataFlow) {
      console.info('[data-flow] Transactions filters updated', {
        updates,
        params: params.toString(),
      })
    }

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
    <Card className="sticky top-6 z-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <IconFilter className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Filters</p>
            <p className="text-xs text-slate-500">{filterSummary}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
            {REVIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleReviewChange(option.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 transition',
                  activeReviewed === option.value
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'hover:bg-slate-50'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
            <IconRefresh className="h-4 w-4" />
            Refresh
          </Button>
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            Clear filters
          </button>
          <span className="text-xs text-slate-500">Updated {lastUpdated}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.4fr)] lg:items-center">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="account-filter">
            Account
          </label>
          <Select
            id="account-filter"
            value={accountId || ''}
            onChange={(event) => handleAccountChange(event.target.value)}
            aria-label="Select account"
          >
            {accounts.length === 0 && <option value="">No accounts</option>}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.institution ? ` · ${account.institution}` : ''}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="transaction-search">
            Search
          </label>
          <div className="relative">
            <Input
              id="transaction-search"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search payee, description, or reference"
              className="pr-10"
              aria-label="Search transactions"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Clear search"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant="secondary"
              size="sm"
              onClick={() => handleRangeChange(option.value)}
              className={cn(
                'border border-slate-200 bg-white text-slate-600',
                range === option.value && 'border-emerald-600 bg-emerald-50 text-emerald-700'
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <IconFilter className="h-4 w-4 text-slate-400" />
          Advanced filters
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <Badge key={chip}>{chip}</Badge>
          ))}
        </div>
      )}

      {range === 'custom' && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="custom-start">
              Start date
            </label>
            <Input
              id="custom-start"
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="custom-end">
              End date
            </label>
            <Input
              id="custom-end"
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
            />
          </div>
          <Button variant="primary" onClick={applyCustomRange} disabled={!customStart || !customEnd}>
            Apply
          </Button>
        </div>
      )}
    </Card>
  )
}
