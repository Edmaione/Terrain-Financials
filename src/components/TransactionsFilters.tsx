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
}: {
  reviewed?: string
  range: string
  startDate?: string
  endDate?: string
  lastUpdated: string
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

  const activeReviewed = reviewed ?? 'all'

  const filterSummary = useMemo(() => {
    const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? 'This Month'
    const reviewLabel = REVIEW_OPTIONS.find((option) => option.value === activeReviewed)?.label ?? 'All'
    return `${rangeLabel} · ${reviewLabel}`
  }, [range, activeReviewed])

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
    updateParams({ reviewed: value === 'all' ? null : value })
  }

  const applyCustomRange = () => {
    updateParams({ range: 'custom', start: customStart, end: customEnd })
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">Filters</p>
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
          <span className="text-xs text-slate-500">Updated {lastUpdated}</span>
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
