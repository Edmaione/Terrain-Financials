import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import TransactionTable from '@/components/TransactionTable'
import TransactionsFilters from '@/components/TransactionsFilters'
import PageHeader from '@/components/PageHeader'
import AlertBanner from '@/components/AlertBanner'
import { buttonVariants } from '@/components/ui/Button'
import AccountFilter from '@/components/AccountFilter'
import { Account, AccountSummary } from '@/types'

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
  status,
  query: searchQuery,
}: {
  reviewed?: string
  range: string
  start?: string
  end?: string
  accountId?: string
  status?: string
  query?: string
}) {
  const debugDataFlow = process.env.DEBUG_DATA_FLOW === 'true'
  const dateRange = getDateRange(range, start, end)
  const reviewedFilter =
    reviewed === 'true' ? true : reviewed === 'false' ? false : null
  const statusFilter = status && status !== 'all' ? status : null
  const search = searchQuery?.trim() || null
  const appliedFilters = {
    accountId: accountId || null,
    reviewed: reviewedFilter,
    dateRange,
    status: statusFilter,
    search,
  }

  let query = supabaseAdmin
    .from('transactions')
    .select(`
      *,
      accounts:accounts!inner(name, type, institution),
      customer:customers!transactions_customer_id_fkey(name),
      vendor:vendors!transactions_vendor_id_fkey(name),
      transfer_account:accounts!transactions_transfer_account_id_fkey(name),
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
  if (statusFilter) {
    const statusCandidates = new Set<string>([statusFilter, statusFilter.toUpperCase()])
    if (statusFilter === 'posted') {
      statusCandidates.add('SETTLED')
      statusCandidates.add('APPROVED')
    }
    if (statusFilter === 'pending') {
      statusCandidates.add('PENDING')
    }
    query = query.in('status', Array.from(statusCandidates))
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

async function getBankAccounts(): Promise<Account[]> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .neq('name', 'Maione Landscapes')
    .in('type', ['checking', 'savings', 'credit_card', 'loan'])
    .order('display_order', { ascending: true })

  if (error) {
    console.error('Error fetching bank accounts:', error)
    return []
  }

  const accounts = data || []

  for (const account of accounts) {
    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('account_id', account.id)

    if (transactionsError) {
      console.error('Error fetching account balance:', transactionsError)
      account.current_balance = account.current_balance ?? 0
      continue
    }

    account.current_balance =
      transactions?.reduce((sum, transaction) => sum + (transaction.amount ?? 0), 0) || 0
  }

  return accounts
}

function formatLastUpdate(dateString?: string | null) {
  if (!dateString) {
    return 'No recent activity'
  }
  const formatted = new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `Last activity ${formatted}`
}

async function getAccountSummaries(
  accounts: Account[]
): Promise<{ summaries: AccountSummary[]; latestDate: string | null }> {
  if (accounts.length === 0) {
    return { summaries: [], latestDate: null }
  }

  const accountIds = accounts.map((account) => account.id)
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('account_id, date, reviewed, review_status, status')
    .in('account_id', accountIds)

  if (error || !data) {
    console.error('Error fetching account summaries:', error)
    return {
      summaries: accounts.map((account) => ({
        account,
        balance: account.current_balance ?? 0,
        pending_count: 0,
        unreviewed_count: 0,
        last_transaction_date: 'No recent activity',
      })),
      latestDate: null,
    }
  }

  const summaryByAccount = new Map<string, AccountSummary>()
  const lastDateByAccount = new Map<string, string>()
  accounts.forEach((account) => {
    summaryByAccount.set(account.id, {
      account,
      balance: account.current_balance ?? 0,
      pending_count: 0,
      unreviewed_count: 0,
      last_transaction_date: 'No recent activity',
    })
  })

  for (const transaction of data) {
    const summary = summaryByAccount.get(transaction.account_id)
    if (!summary) continue

    const normalizedStatus =
      typeof transaction.status === 'string' ? transaction.status.toLowerCase() : ''

    if (normalizedStatus === 'pending') {
      summary.pending_count += 1
    }

    if (transaction.reviewed === false || transaction.review_status === 'needs_review') {
      summary.unreviewed_count += 1
    }

    if (transaction.date) {
      const currentLast = lastDateByAccount.get(transaction.account_id)
      if (!currentLast || new Date(transaction.date) > new Date(currentLast)) {
        lastDateByAccount.set(transaction.account_id, transaction.date)
      }
    }
  }

  const summaries = Array.from(summaryByAccount.values()).map((summary) => {
    const lastDate = lastDateByAccount.get(summary.account.id)
    return {
      ...summary,
      last_transaction_date: formatLastUpdate(lastDate),
    }
  })
  const latestDate = Array.from(lastDateByAccount.values()).sort().pop() ?? null

  return { summaries, latestDate }
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
    status?: string
    q?: string
  }
}) {
  const isAllAccounts = searchParams.account_id === 'all'
  const bankAccounts = await getBankAccounts()
  const selectedAccount = isAllAccounts
    ? null
    : bankAccounts.find((account) => account.id === searchParams.account_id) ?? null
  const fallbackAccount = selectedAccount ?? bankAccounts[0] ?? null

  const activeRange = searchParams.range ?? 'last_3_months'
  const activeReviewed = searchParams.reviewed ?? 'false'
  const activeStatus = searchParams.status ?? 'all'

  const needsDefaultFilters =
    !searchParams.range || !searchParams.reviewed || !searchParams.account_id || !searchParams.status

  const needsRedirect =
    Boolean(fallbackAccount) &&
    !isAllAccounts &&
    fallbackAccount.id !== searchParams.account_id

  if (fallbackAccount && !isAllAccounts && (needsRedirect || needsDefaultFilters)) {
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
    params.set('account_id', fallbackAccount.id)
    params.set('range', activeRange)
    params.set('reviewed', activeReviewed)
    params.set('status', activeStatus)
    redirect(`/transactions?${params.toString()}`)
  }

  if (!fallbackAccount && !isAllAccounts) {
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
  if (activeStatus) {
    allTimeParams.set('status', activeStatus)
  }
  if (isAllAccounts) {
    allTimeParams.set('account_id', 'all')
  } else if (fallbackAccount) {
    allTimeParams.set('account_id', fallbackAccount.id)
  }
  if (searchParams.q) {
    allTimeParams.set('q', searchParams.q)
  }
  allTimeParams.set('range', 'all')
  if (needsDefaultFilters && isAllAccounts) {
    const params = new URLSearchParams(allTimeParams)
    params.set('range', activeRange)
    params.set('reviewed', activeReviewed)
    params.set('status', activeStatus)
    params.set('account_id', 'all')
    redirect(`/transactions?${params.toString()}`)
  }
  const { data: transactions, error, dateRange } = await getTransactions({
    reviewed: activeReviewed,
    range: activeRange,
    start: searchParams.start,
    end: searchParams.end,
    accountId: isAllAccounts ? undefined : fallbackAccount?.id ?? '',
    status: activeStatus,
    query: searchParams.q,
  })
  const categories = await getCategories()
  const { summaries: accountSummaries, latestDate: latestAccountDate } =
    await getAccountSummaries(bankAccounts)
  const allSummary: AccountSummary = {
    account: {
      id: 'all',
      name: 'All accounts',
      type: 'checking',
      institution: 'All institutions',
      is_active: true,
      opening_balance: 0,
      current_balance: accountSummaries.reduce((total, summary) => total + summary.balance, 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    balance: accountSummaries.reduce((total, summary) => total + summary.balance, 0),
    pending_count: accountSummaries.reduce((total, summary) => total + summary.pending_count, 0),
    unreviewed_count: accountSummaries.reduce(
      (total, summary) => total + summary.unreviewed_count,
      0
    ),
    last_transaction_date: formatLastUpdate(latestAccountDate),
  }

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
  const statusLabel =
    activeStatus === 'pending'
      ? 'Pending'
      : activeStatus === 'posted'
        ? 'Posted'
        : activeStatus === 'reconciled'
          ? 'Reconciled'
          : 'All statuses'
  const filterSummary = `${dateRange.label} · ${reviewedLabel} · ${statusLabel}`
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

      <AccountFilter
        summaries={accountSummaries}
        allSummary={allSummary}
        selectedAccountId={isAllAccounts ? 'all' : fallbackAccount?.id}
      />

      <TransactionsFilters
        reviewed={activeReviewed}
        range={activeRange}
        startDate={dateRange.start}
        endDate={dateRange.end}
        lastUpdated={lastUpdated}
        accounts={bankAccounts}
        accountId={isAllAccounts ? 'all' : fallbackAccount?.id}
        query={searchParams.q}
        status={activeStatus}
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
        accountId={isAllAccounts ? undefined : fallbackAccount?.id ?? ''}
      />
    </div>
  )
}
