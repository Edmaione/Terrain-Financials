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
        {/* Review Status Filter */}
        <div>
          <label className="label">Status</label>
          <div className="flex gap-2">
            <button
              onClick={() => updateFilter('reviewed', null)}
              disabled={isPending}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !currentReviewed
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } disabled:opacity-50`}
            >
              All
            </button>
            <button
              onClick={() => updateFilter('reviewed', 'false')}
              disabled={isPending}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentReviewed === 'false'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } disabled:opacity-50`}
            >
              Need Review
            </button>
            <button
              onClick={() => updateFilter('reviewed', 'true')}
              disabled={isPending}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentReviewed === 'true'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } disabled:opacity-50`}
            >
              Reviewed
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="label">Date Range</label>
          <div className="flex flex-wrap gap-2">
            {dateRanges.map((range) => (
              <button
                key={range}
                onClick={() => updateFilter('range', range)}
                disabled={isPending}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currentRange === range
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                {getDateRangeLabel(range)}
              </button>
            ))}
          </div>
        </div>

        {/* Search Filter */}
        <div>
          <label className="label">Search</label>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by payee or description..."
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
