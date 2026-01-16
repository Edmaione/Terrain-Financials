'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { IconFilter } from '@/components/ui/icons'
import { getDateRangeLabel, type DateRangePreset } from '@/lib/date-utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

interface TransactionFiltersProps {
  currentReviewed?: string
  currentRange: string
  currentSearch?: string
}

export default function TransactionFilters({
  currentReviewed,
  currentRange,
  currentSearch,
}: TransactionFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(currentSearch || '')

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    startTransition(() => {
      router.push(`/transactions?${params.toString()}`)
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilter('search', searchValue || null)
  }

  const dateRanges: DateRangePreset[] = [
    'this_month',
    'last_month',
    'last_3_months',
    'ytd',
    'all_time',
  ]

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <IconFilter className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Filters</p>
          <p className="text-xs text-slate-500">Refine transactions quickly.</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
          <div className="mt-2 flex gap-2">
            {[
              { value: null, label: 'All' },
              { value: 'false', label: 'Need review' },
              { value: 'true', label: 'Reviewed' },
            ].map((option) => (
              <Button
                key={option.label}
                variant="outline"
                size="sm"
                onClick={() => updateFilter('reviewed', option.value)}
                disabled={isPending}
                className={cn(
                  'rounded-full border border-slate-200 bg-white text-slate-600',
                  (option.value === null && !currentReviewed) || currentReviewed === option.value
                    ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                    : ''
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date range</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {dateRanges.map((range) => (
              <Button
                key={range}
                variant="outline"
                size="sm"
                onClick={() => updateFilter('range', range)}
                disabled={isPending}
                className={cn(
                  'rounded-full border border-slate-200 bg-white text-slate-600',
                  currentRange === range ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : ''
                )}
              >
                {getDateRangeLabel(range)}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
          <form onSubmit={handleSearchSubmit} className="mt-2 flex flex-wrap gap-2">
            <Input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by payee or description"
              className="flex-1"
            />
            <Button type="submit" disabled={isPending} variant="primary">
              Search
            </Button>
            {currentSearch && (
              <Button
                type="button"
                onClick={() => {
                  setSearchValue('')
                  updateFilter('search', null)
                }}
                disabled={isPending}
                variant="secondary"
              >
                Clear
              </Button>
            )}
          </form>
        </div>
      </div>
    </Card>
  )
}
