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
import { normalizeTransactionFilters } from '@/lib/transaction-filters'

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
  reviewStatus,
  range,
  start,
  end,
  accountId,
  bankStatus,
  reconciliationStatus,
  categoryId,
  amountMin,
  amountMax,
  sourceSystem,
  importId,
  query: searchQuery,
  page,
  pageSize,
  includeDeleted,
}: {
  reviewStatus?: string
  range: string
  start?: string
  end?: string
  accountId?: string
  bankStatus?: string
  reconciliationStatus?: string
  categoryId?: string
  amountMin?: string
  amountMax?: string
  sourceSystem?: string
  importId?: string
  query?: string
  page: number
  pageSize: number
  includeDeleted?: boolean
}) {
  const debugDataFlow = process.env.DEBUG_DATA_FLOW === 'true'
  const dateRange = getDateRange(range, start, end)
  const normalizedFilters = normalizeTransactionFilters({
    reviewStatus,
    bankStatus,
    reconciliationStatus,
    categoryId,
    amountMin,
    amountMax,
    sourceSystem,
    importId,
    search: searchQuery,
  })
  const reviewFilter = normalizedFilters.reviewStatus
  const bankStatusFilter = normalizedFilters.bankStatus
  const reconciliationFilter = normalizedFilters.reconciliationStatus
  const search = normalizedFilters.search
  const minAmount = normalizedFilters.amountMin
  const maxAmount = normalizedFilters.amountMax
  const sourceFilter = normalizedFilters.sourceSystem
  const importFilter = normalizedFilters.importId
  const appliedFilters = {
    accountId: accountId || null,
    reviewStatus: reviewFilter,
    dateRange,
    bankStatus: bankStatusFilter,
    reconciliationStatus: reconciliationFilter,
    categoryId: normalizedFilters.categoryId,
    amountMin: minAmount,
    amountMax: maxAmount,
    sourceSystem: sourceFilter,
    importId: importFilter,
    includeDeleted: Boolean(includeDeleted),
    search,
  }

  let query = supabaseAdmin
    .from('transactions')
    .select(`
      *,
      accounts:accounts!transactions_account_id_fkey(name, type, institution),
      customer:customers!transactions_customer_id_fkey(name),
      vendor:vendors!transactions_vendor_id_fkey(name),
      transfer_to_account:accounts!transactions_transfer_to_account_id_fkey(name),
      category:categories!category_id(name, section),
      subcategory:categories!subcategory_id(name, section),
      primary_category:categories!primary_category_id(name, section),
      ai_suggested:categories!ai_suggested_category(id, name, section)
    `)
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (accountId) {
    query = query.eq('account_id', accountId)
  }
  if (bankStatusFilter) {
    query = query.eq('bank_status', bankStatusFilter)
  }
  if (reconciliationFilter) {
    query = query.eq('reconciliation_status', reconciliationFilter)
  }
  if (reviewFilter) {
    query = query.eq('review_status', reviewFilter)
  }
  if (dateRange.start) {
    query = query.gte('date', dateRange.start)
  }
  if (dateRange.end) {
    query = query.lte('date', dateRange.end)
  }
  if (Number.isFinite(minAmount)) {
    query = query.gte('amount', minAmount as number)
  }
  if (Number.isFinite(maxAmount)) {
    query = query.lte('amount', maxAmount as number)
  }
  if (sourceFilter) {
    query = query.eq('source', sourceFilter)
  }
  if (importFilter) {
    query = query.eq('import_id', importFilter)
  }
  if (normalizedFilters.categoryId) {
    const { data: categoryRows } = await supabaseAdmin
      .from('categories')
      .select('id')
      .or(`id.eq.${normalizedFilters.categoryId},parent_id.eq.${normalizedFilters.categoryId}`)
    const categoryIds = (categoryRows ?? []).map((row) => row.id)
    if (!categoryIds.includes(normalizedFilters.categoryId)) {
      categoryIds.push(normalizedFilters.categoryId)
    }
    if (categoryIds.length > 0) {
      query = query.or(
        `category_id.in.(${categoryIds.join(',')}),primary_category_id.in.(${categoryIds.join(',')}),subcategory_id.in.(${categoryIds.join(',')})`
      )
    }
  }
  if (search) {
    query = query.or(
      `payee.ilike.%${search}%,payee_display.ilike.%${search}%,description.ilike.%${search}%,reference.ilike.%${search}%`
    )
  }
  const offset = (page - 1) * pageSize
  query = query.range(offset, offset + pageSize - 1)

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
    .in('type', ['checking', 'savings', 'credit_card', 'loan'])
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching bank accounts:', error)
    return []
  }

  const accounts = data || []
  if (accounts.length > 0) {
    const accountIds = accounts.map((account) => account.id)
    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from('transactions')
      .select('account_id, amount')
      .in('account_id', accountIds)
      .is('deleted_at', null)

    if (transactionsError) {
      console.error('Error fetching account balances:', transactionsError)
      return accounts.map((account) => ({
        ...account,
        current_balance: account.current_balance ?? 0,
      }))
    }

    const totals = new Map<string, number>()
    for (const row of transactions || []) {
      const current = totals.get(row.account_id) ?? 0
      totals.set(row.account_id, current + (row.amount ?? 0))
    }

    return accounts.map((account) => ({
      ...account,
      current_balance: totals.get(account.id) ?? 0,
    }))
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
    .select('account_id, date, review_status, bank_status')
    .in('account_id', accountIds)
    .is('deleted_at', null)

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

    if (transaction.bank_status === 'pending') {
      summary.pending_count += 1
    }

    if (transaction.review_status === 'needs_review') {
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
    review_status?: string
    range?: string
    start?: string
    end?: string
    account_id?: string
    bank_status?: string
    reconciliation_status?: string
    category_id?: string
    amount_min?: string
    amount_max?: string
    source_system?: string
    import_id?: string
    include_deleted?: string
    q?: string
    page?: string
    reviewed?: string
    status?: string
  }
}) {
  const isAllAccounts = searchParams.account_id === 'all'
  const bankAccounts = await getBankAccounts()
  const accounts = bankAccounts
  const selectedAccount = isAllAccounts
    ? null
    : bankAccounts.find((account) => account.id === searchParams.account_id) ?? null
  const fallbackAccount = selectedAccount ?? bankAccounts[0] ?? null

  const activeRange = searchParams.range ?? 'last_3_months'
  const legacyReviewed = searchParams.reviewed
  const legacyStatus = searchParams.status
  const activeReviewStatus =
    searchParams.review_status ??
    (legacyReviewed === 'true'
      ? 'approved'
      : legacyReviewed === 'false'
        ? 'needs_review'
        : 'all')
  const activeBankStatus = searchParams.bank_status ?? legacyStatus ?? 'all'
  const activeReconciliationStatus = searchParams.reconciliation_status ?? 'all'
  const activeCategoryId = searchParams.category_id ?? ''
  const activeAmountMin = searchParams.amount_min ?? ''
  const activeAmountMax = searchParams.amount_max ?? ''
  const activeSourceSystem = searchParams.source_system ?? 'all'
  const activeImportId = searchParams.import_id ?? ''
  const includeDeleted = searchParams.include_deleted === 'true'
  const page = Number.parseInt(searchParams.page ?? '1', 10)
  const safePage = Number.isFinite(page) && page > 0 ? page : 1
  const pageSize = 50

  const needsDefaultFilters =
    !searchParams.range ||
    !searchParams.account_id ||
    !searchParams.review_status ||
    !searchParams.bank_status ||
    !searchParams.reconciliation_status

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
    params.set('review_status', activeReviewStatus)
    params.set('bank_status', activeBankStatus)
    params.set('reconciliation_status', activeReconciliationStatus)
    if (activeCategoryId) {
      params.set('category_id', activeCategoryId)
    }
    if (activeAmountMin) {
      params.set('amount_min', activeAmountMin)
    }
    if (activeAmountMax) {
      params.set('amount_max', activeAmountMax)
    }
    if (activeSourceSystem) {
      params.set('source_system', activeSourceSystem)
    }
    if (activeImportId) {
      params.set('import_id', activeImportId)
    }
    if (includeDeleted) {
      params.set('include_deleted', 'true')
    }
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
  if (activeReviewStatus) {
    allTimeParams.set('review_status', activeReviewStatus)
  }
  if (activeBankStatus) {
    allTimeParams.set('bank_status', activeBankStatus)
  }
  if (activeReconciliationStatus) {
    allTimeParams.set('reconciliation_status', activeReconciliationStatus)
  }
  if (isAllAccounts) {
    allTimeParams.set('account_id', 'all')
  } else if (fallbackAccount) {
    allTimeParams.set('account_id', fallbackAccount.id)
  }
  if (searchParams.q) {
    allTimeParams.set('q', searchParams.q)
  }
  if (activeCategoryId) {
    allTimeParams.set('category_id', activeCategoryId)
  }
  if (activeAmountMin) {
    allTimeParams.set('amount_min', activeAmountMin)
  }
  if (activeAmountMax) {
    allTimeParams.set('amount_max', activeAmountMax)
  }
  if (activeSourceSystem) {
    allTimeParams.set('source_system', activeSourceSystem)
  }
  if (activeImportId) {
    allTimeParams.set('import_id', activeImportId)
  }
  if (includeDeleted) {
    allTimeParams.set('include_deleted', 'true')
  }
  allTimeParams.set('range', 'all')
  if (needsDefaultFilters && isAllAccounts) {
    const params = new URLSearchParams(allTimeParams)
    params.set('range', activeRange)
    params.set('review_status', activeReviewStatus)
    params.set('bank_status', activeBankStatus)
    params.set('reconciliation_status', activeReconciliationStatus)
    params.set('account_id', 'all')
    redirect(`/transactions?${params.toString()}`)
  }
  const { data: transactions, error, dateRange } = await getTransactions({
    reviewStatus: activeReviewStatus,
    range: activeRange,
    start: searchParams.start,
    end: searchParams.end,
    accountId: isAllAccounts ? undefined : fallbackAccount?.id ?? '',
    bankStatus: activeBankStatus,
    reconciliationStatus: activeReconciliationStatus,
    categoryId: activeCategoryId || undefined,
    amountMin: activeAmountMin || undefined,
    amountMax: activeAmountMax || undefined,
    sourceSystem: activeSourceSystem || undefined,
    importId: activeImportId || undefined,
    query: searchParams.q,
    page: safePage,
    pageSize,
    includeDeleted,
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
    activeReviewStatus === 'approved'
      ? 'Approved'
      : activeReviewStatus === 'needs_review'
        ? 'Needs review'
        : 'All review statuses'
  const bankStatusLabel =
    activeBankStatus === 'pending'
      ? 'Pending'
      : activeBankStatus === 'posted'
        ? 'Posted'
        : 'All bank statuses'
  const reconciliationLabel =
    activeReconciliationStatus === 'unreconciled'
      ? 'Unreconciled'
      : activeReconciliationStatus === 'cleared'
        ? 'Cleared'
        : activeReconciliationStatus === 'reconciled'
          ? 'Reconciled'
          : 'All reconciliation statuses'
  const filterSummary = `${dateRange.label} · ${reviewedLabel} · ${bankStatusLabel} · ${reconciliationLabel}`
  const showDebugPanel = process.env.DEBUG_DATA_FLOW === 'true'

  const refreshParams = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      refreshParams.set(key, value)
    }
  })
  const hasNextPage = transactions.length === pageSize
  const prevParams = new URLSearchParams(refreshParams)
  const nextParams = new URLSearchParams(refreshParams)
  if (safePage > 1) {
    if (safePage - 1 === 1) {
      prevParams.delete('page')
    } else {
      prevParams.set('page', String(safePage - 1))
    }
  }
  nextParams.set('page', String(safePage + 1))

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
        reviewStatus={activeReviewStatus}
        range={activeRange}
        startDate={dateRange.start}
        endDate={dateRange.end}
        lastUpdated={lastUpdated}
        accounts={accounts}
        accountId={isAllAccounts ? 'all' : fallbackAccount?.id}
        query={searchParams.q}
        bankStatus={activeBankStatus}
        reconciliationStatus={activeReconciliationStatus}
        categoryId={activeCategoryId}
        amountMin={activeAmountMin}
        amountMax={activeAmountMax}
        sourceSystem={activeSourceSystem}
        importId={activeImportId}
        includeDeleted={includeDeleted ? 'true' : 'false'}
        categories={categories}
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
            <div>Review status: {activeReviewStatus}</div>
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
        accounts={accounts}
        accountId={isAllAccounts ? undefined : fallbackAccount?.id ?? ''}
      />

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Page {safePage}
        </div>
        <div className="flex items-center gap-2">
          {safePage > 1 && (
            <Link
              href={`/transactions?${prevParams.toString()}`}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Previous
            </Link>
          )}
          {hasNextPage && (
            <Link
              href={`/transactions?${nextParams.toString()}`}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
