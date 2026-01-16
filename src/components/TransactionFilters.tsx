'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { getDateRangeLabel, type DateRangePreset } from '@/lib/date-utils';

interface TransactionFiltersProps {
  currentReviewed?: string;
  currentRange: string;
  currentSearch?: string;
}

export default function TransactionFilters({
  currentReviewed,
  currentRange,
  currentSearch,
}: TransactionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(currentSearch || '');

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    startTransition(() => {
      router.push(`/transactions?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('search', searchValue || null);
  };

  const dateRanges: DateRangePreset[] = [
    'this_month',
    'last_month',
    'last_3_months',
    'ytd',
    'all_time',
  ];

  return (
    <div className="card">
      <div className="space-y-4">
        <div>
          <label className="label">Status</label>
          <div className="flex gap-2">
            {[
              { value: null, label: 'All' },
              { value: 'false', label: 'Need Review' },
              { value: 'true', label: 'Reviewed' },
            ].map((option) => (
              <button
                key={option.label}
                onClick={() => updateFilter('reviewed', option.value)}
                disabled={isPending}
                className={`pill ${
                  (option.value === null && !currentReviewed) || currentReviewed === option.value
                    ? 'pill-active'
                    : 'pill-inactive'
                } disabled:opacity-50`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Date Range</label>
          <div className="flex flex-wrap gap-2">
            {dateRanges.map((range) => (
              <button
                key={range}
                onClick={() => updateFilter('range', range)}
                disabled={isPending}
                className={`pill ${currentRange === range ? 'pill-active' : 'pill-inactive'} disabled:opacity-50`}
              >
                {getDateRangeLabel(range)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Search</label>
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by payee or description"
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary disabled:opacity-50"
            >
              Search
            </button>
            {currentSearch && (
              <button
                type="button"
                onClick={() => {
                  setSearchValue('');
                  updateFilter('search', null);
                }}
                disabled={isPending}
                className="btn-secondary disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
