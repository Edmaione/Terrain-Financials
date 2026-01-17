'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { IconCalendar } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all_time', label: 'All time' },
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
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <IconCalendar className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Report filters</p>
          <p className="text-xs text-slate-500">Select accounts and ranges for reporting.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)]">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="reports-account">
            Account
          </label>
          <Select
            id="reports-account"
            value={accountId || ''}
            onChange={(event) => updateParams({ account_id: event.target.value })}
            className="mt-2 w-full"
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
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="reports-range">
            Range
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
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
        </div>
      </div>

      {range === 'custom' && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="reports-start">
              Start date
            </label>
            <Input
              id="reports-start"
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="reports-end">
              End date
            </label>
            <Input
              id="reports-end"
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
