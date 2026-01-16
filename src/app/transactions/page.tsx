import { supabaseAdmin } from '@/lib/supabase'
import TransactionTable from '@/components/TransactionTable'
import TransactionsFilters from '@/components/TransactionsFilters'

export const dynamic = 'force-dynamic'

type DateRange = {
  start?: string
  end?: string
  label: string
}

function toDateString(date: Date) {
  return date.toISOString().split('T')[0]
}

function getDateRange(range: string, start?: string, end?: string): DateRange {
  const now = new Date()

  switch (range) {
    case 'last_month': {
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endDate = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: toDateString(startDate), end: toDateString(endDate), label: 'Last Month' }
    }
    case 'last_3_months': {
      const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { start: toDateString(startDate), end: toDateString(now), label: 'Last 3 Months' }
    }
    case 'ytd': {
      const startDate = new Date(now.getFullYear(), 0, 1)
      return { start: toDateString(startDate), end: toDateString(now), label: 'Year to Date' }
    }
    case 'all': {
      return { label: 'All Time' }
    }
    case 'custom': {
      if (start && end) {
        return { start, end, label: 'Custom Range' }
      }
      return { start: toDateString(new Date(now.getFullYear(), now.getMonth(), 1)), end: toDateString(now), label: 'This Month' }
    }
    case 'this_month':
    default: {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: toDateString(startDate), end: toDateString(now), label: 'This Month' }
    }
  }
}

async function getTransactions({
  reviewed,
  range,
  start,
  end,
}: {
  reviewed?: string
  range: string
  start?: string
  end?: string
}) {
  const debugDataFlow = process.env.DEBUG_DATA_FLOW === 'true'
  const dateRange = getDateRange(range, start, end)

  let query = supabaseAdmin
    .from('transactions')
    .select(`
      *,
      account:accounts!transactions_account_id_fkey(name),
      transfer_to_account:accounts!transactions_transfer_to_account_id_fkey(name),
      category:categories!category_id(name, section),
      ai_suggested:categories!ai_suggested_category(name, section)
    `)
    .order('date', { ascending: false })

  if (reviewed === 'false') {
    query = query.eq('reviewed', false)
  }
  if (reviewed === 'true') {
    query = query.eq('reviewed', true)
  }
  if (dateRange.start) {
    query = query.gte('date', dateRange.start)
  }
  if (dateRange.end) {
    query = query.lte('date', dateRange.end)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching transactions:', error)
    return { data: [], error, dateRange }
  }

  if (debugDataFlow) {
    console.info('[data-flow] Transactions fetched', {
      reviewedFilter: reviewed,
      range,
      dateRange,
      count: data?.length || 0,
    })
  }

  return { data: data || [], error: null, dateRange }
}

async function getCategories() {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, name, section')
    .order('section', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching categories:', error)
    return []
  }

  return data || []
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { reviewed?: string; range?: string; start?: string; end?: string }
}) {
  const activeRange = searchParams.range ?? 'this_month'
  const allTimeParams = new URLSearchParams()
  if (searchParams.reviewed) {
    allTimeParams.set('reviewed', searchParams.reviewed)
  }
  allTimeParams.set('range', 'all')
  const { data: transactions, error, dateRange } = await getTransactions({
    reviewed: searchParams.reviewed,
    range: activeRange,
    start: searchParams.start,
    end: searchParams.end,
  })
  const categories = await getCategories()

  const lastUpdated = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const filterSummary = `${dateRange.label}${searchParams.reviewed ? ` · ${searchParams.reviewed === 'true' ? 'Reviewed' : 'Unreviewed'}` : ' · All statuses'}`
  const showDebugPanel = process.env.DEBUG_DATA_FLOW === 'true'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Transactions</h1>
        <p className="text-sm text-slate-500">
          Review, categorize, and understand every transaction across your accounts.
        </p>
      </div>

      <TransactionsFilters
        reviewed={searchParams.reviewed}
        range={activeRange}
        startDate={dateRange.start}
        endDate={dateRange.end}
        lastUpdated={lastUpdated}
      />

      {error && (
        <div className="card border border-red-200 bg-red-50 text-red-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">We couldn&apos;t load transactions.</h2>
              <p className="text-sm text-red-700">
                Please try again or refresh the page. If the issue persists, check the error details below.
              </p>
            </div>
          </div>
          <details className="mt-3 text-xs text-red-800">
            <summary className="cursor-pointer font-medium">Error details</summary>
            <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(error, null, 2)}</pre>
          </details>
        </div>
      )}

      {showDebugPanel && (
        <div className="card border-dashed border border-slate-200 bg-slate-50 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">Data Health</div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <div>Reviewed filter: {searchParams.reviewed ?? 'all'}</div>
            <div>Date range: {dateRange.start ?? '—'} → {dateRange.end ?? '—'}</div>
            <div>Range preset: {activeRange}</div>
            <div>Returned rows: {transactions.length}</div>
          </div>
        </div>
      )}

      <TransactionTable
        transactions={transactions}
        filterSummary={filterSummary}
        allTimeHref={`/transactions?${allTimeParams.toString()}`}
        categories={categories}
      />
    </div>
  )
}
