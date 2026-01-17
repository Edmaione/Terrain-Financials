import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import TransactionTable from '@/components/TransactionTable'
import TransactionsFilters from '@/components/TransactionsFilters'
import { resolveAccountSelection } from '@/lib/accounts'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import { buttonVariants } from '@/components/ui/Button'

export const dynamic = 'force-dynamic'

type DateRange = {
  start?: string
  end?: string
  label: string
}

function toDateString(date: Date) {
  return date.toISOString().split('T')[0]
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function getDateRange(range: string, start?: string, end?: string): DateRange {
  const now = new Date()
  const today = toDateString(now)

  switch (range) {
    case 'last_month': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return {
        start: toDateString(startOfMonth(lastMonth)),
        end: toDateString(endOfMonth(lastMonth)),
        label: 'Last month',
      }
    }
    case 'last_3_months': {
      const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { start: toDateString(startOfMonth(startDate)), end: today, label: 'Last 3 months' }
    }
    case 'ytd': {
      const startDate = new Date(now.getFullYear(), 0, 1)
      return { start: toDateString(startDate), end: today, label: 'Year to date' }
    }
    case 'all': {
      return { label: 'All time' }
    }
    case 'custom': {
      if (start && end) {
        return { start, end, label: 'Custom range' }
      }
      return { start: toDateString(startOfMonth(now)), end: today, label: 'This month' }
    }
    case 'this_month':
    default: {
      return { start: toDateString(startOfMonth(now)), end: today, label: 'This month' }
    }
  }
}

async function getTransactions({
  reviewed,
  range,
  start,
  end,
  accountId,
  query: searchQuery,
}: {
  reviewed?: string
  range: string
  start?: string
  end?: string
  accountId: string
  query?: string
}) {
  const debugDataFlow = process.env.DEBUG_DATA_FLOW === 'true'
  const dateRange = getDateRange(range, start, end)
  const reviewedFilter =
    reviewed === 'true' ? true : reviewed === 'false' ? false : null
  const search = searchQuery?.trim() || null
  const appliedFilters = {
    accountId: accountId || null,
    reviewed: reviewedFilter,
    dateRange,
    search,
  }

  let query = supabaseAdmin
    .from('transactions')
    .select(`
      *,
      account:accounts!transactions_account_id_fkey(name),
      transfer_to_account:accounts!transactions_transfer_to_account_id_fkey(name),
      category:categories!category_id(name, section),
      subcategory:categories!subcategory_id(name, section),
      primary_category:categories!primary_category_id(name, section),
      ai_suggested:categories!ai_suggested_category(id, name, section)
    `)
    .order('date', { ascending: false })

  if (accountId) {
    query = query.eq('account_id', accountId)
  }
  if (reviewedFilter === false) {
    query = query.eq('reviewed', false)
  }
  if (reviewedFilter === true) {
    query = query.eq('reviewed', true)
  }
  if (dateRange.start) {
    query = query.gte('date', dateRange.start)
  }
  if (dateRange.end) {
    query = query.lte('date', dateRange.end)
  }
  if (search) {
    query = query.or(
      `payee.ilike.%${search}%,payee_display.ilike.%${search}%,description.ilike.%${search}%,reference.ilike.%${search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching transactions:', error)
    return { data: [], error, dateRange }
  }

  if (debugDataFlow) {
    console.info('[data-flow] Transactions fetched', {
      appliedFilters,
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
  searchParams: {
    reviewed?: string
    range?: string
    start?: string
    end?: string
    account_id?: string
    q?: string
  }
}) {
  const { accounts, selectedAccount, needsRedirect } = await resolveAccountSelection(
    searchParams.account_id
  )

  const activeRange = searchParams.range ?? 'last_3_months'
  const activeReviewed = searchParams.reviewed ?? 'false'

  const needsDefaultFilters =
    !searchParams.range || !searchParams.reviewed || !searchParams.account_id

  if (selectedAccount && (needsRedirect || needsDefaultFilters)) {
    const params = new URLSearchParams()
    if (searchParams.q) {
      params.set('q', searchParams.q)
    }
    if (searchParams.start) {
      params.set('start', searchParams.start)
    }
    if (searchParams.end) {
      params.set('end', searchParams.end)
    }
    params.set('account_id', selectedAccount.id)
    params.set('range', activeRange)
    params.set('reviewed', activeReviewed)
    redirect(`/transactions?${params.toString()}`)
  }

  if (!selectedAccount) {
    return (
      <AlertBanner
        variant="error"
        title="No account available."
        message="Create or activate an account to view transactions."
      />
    )
  }

  const allTimeParams = new URLSearchParams()
  if (activeReviewed) {
    allTimeParams.set('reviewed', activeReviewed)
  }
  if (selectedAccount) {
    allTimeParams.set('account_id', selectedAccount.id)
  }
  if (searchParams.q) {
    allTimeParams.set('q', searchParams.q)
  }
  allTimeParams.set('range', 'all')
  const { data: transactions, error, dateRange } = await getTransactions({
    reviewed: activeReviewed,
    range: activeRange,
    start: searchParams.start,
    end: searchParams.end,
    accountId: selectedAccount?.id ?? '',
    query: searchParams.q,
  })
  const categories = await getCategories()

  const lastUpdated = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const reviewedLabel =
    activeReviewed === 'true'
      ? 'Reviewed'
      : activeReviewed === 'false'
        ? 'Unreviewed'
        : 'All statuses'
  const filterSummary = `${dateRange.label} · ${reviewedLabel}`
  const showDebugPanel = process.env.DEBUG_DATA_FLOW === 'true'

  const refreshParams = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      refreshParams.set(key, value)
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        label="Transactions"
        title="Transaction review"
        description="Review, categorize, and understand every transaction across your accounts."
        actions={(
          <>
            <Link href={`/transactions?${refreshParams.toString()}`} className={buttonVariants({ variant: 'secondary' })}>
              Refresh
            </Link>
            <Link href="/upload" className={buttonVariants({ variant: 'primary' })}>
              Upload CSV
            </Link>
          </>
        )}
      />

      <TransactionsFilters
        reviewed={activeReviewed}
        range={activeRange}
        startDate={dateRange.start}
        endDate={dateRange.end}
        lastUpdated={lastUpdated}
        accounts={accounts}
        accountId={selectedAccount?.id}
        query={searchParams.q}
      />

      {error && (
        <AlertBanner
          variant="error"
          title="We could not load transactions."
          message="Please try again or refresh the page. If the issue persists, check the error details below."
          actions={(
            <Link href={`/transactions?${refreshParams.toString()}`} className={buttonVariants({ variant: 'secondary' })}>
              Retry
            </Link>
          )}
        />
      )}

      {error && (
        <details className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <summary className="cursor-pointer font-medium">Error details</summary>
          <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(error, null, 2)}</pre>
        </details>
      )}

      {showDebugPanel && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">Data Health</div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <div>Reviewed filter: {searchParams.reviewed ?? 'all'}</div>
            <div>Date range: {dateRange.start ?? 'N/A'} to {dateRange.end ?? 'N/A'}</div>
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
        accountId={selectedAccount?.id ?? ''}
      />
    </div>
  )
}
