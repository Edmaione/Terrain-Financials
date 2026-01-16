import { supabaseAdmin } from '@/lib/supabase'
import TransactionTable from '@/components/TransactionTable'

async function getTransactions(reviewed?: string) {
  let query = supabaseAdmin
    .from('transactions')
    .select(`
      *,
      account:accounts(name),
      category:categories!category_id(name, section),
      ai_suggested:categories!ai_suggested_category(name, section)
    `)
    .order('date', { ascending: false })
    .limit(100)
  
  if (reviewed === 'false') {
    query = query.eq('reviewed', false)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
  
  return data || []
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { reviewed?: string }
}) {
  const transactions = await getTransactions(searchParams.reviewed)
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-1 text-sm text-gray-500">
            {searchParams.reviewed === 'false' 
              ? 'Review and categorize transactions'
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
            href="/transactions?reviewed=false"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              searchParams.reviewed === 'false'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Need Review
          </a>
        </div>
      </div>
      
      <TransactionTable transactions={transactions} />
    </div>
  )
}
