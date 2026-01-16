import { supabaseAdmin } from '@/lib/supabase'
import TransactionTable from '@/components/TransactionTable'

export const dynamic = 'force-dynamic'

async function getTransactions(reviewed?: string) {
  const debugIngest = process.env.INGEST_DEBUG === 'true'
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
    .limit(100)
  
  if (reviewed === 'false') {
    query = query.eq('reviewed', false)
  }
  if (reviewed === 'true') {
    query = query.eq('reviewed', true)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching transactions:', error)
    return { data: [], error }
  }

  if (debugIngest) {
    console.info('[ingest] Transactions fetched', {
      reviewedFilter: reviewed,
      count: data?.length || 0,
    })
  }

  return { data: data || [], error: null }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { reviewed?: string }
}) {
  const { data: transactions, error } = await getTransactions(searchParams.reviewed)
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-1 text-sm text-gray-500">
            {searchParams.reviewed === 'false'
              ? 'Review and categorize transactions'
              : searchParams.reviewed === 'true'
                ? 'Reviewed transactions'
                : 'All imported transactions'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <a
            href="/transactions"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !searchParams.reviewed
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </a>
          <a
            href="/transactions?reviewed=true"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              searchParams.reviewed === 'true'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Reviewed
          </a>
          <a
            href="/transactions?reviewed=false"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              searchParams.reviewed === 'false'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Need Review
          </a>
          <a
            href={searchParams.reviewed ? `/transactions?reviewed=${searchParams.reviewed}` : '/transactions'}
            className="px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          >
            Refresh
          </a>
        </div>
      </div>

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
      
      <TransactionTable transactions={transactions} />
    </div>
  )
}
