import { supabaseAdmin } from '@/lib/supabase';
import { parseDateRange } from '@/lib/date-utils';
import TransactionTable from '@/components/TransactionTable';
import TransactionFilters from '@/components/TransactionFilters';

interface SearchParams {
  reviewed?: string;
  range?: string;
  start?: string;
  end?: string;
  search?: string;
}

async function getTransactions(searchParams: SearchParams) {
  try {
    // Parse date range (default to last_3_months)
    const dateRange = parseDateRange(
      searchParams.range || 'last_3_months',
      searchParams.start,
      searchParams.end
    );

    // Build base query
    let query = supabaseAdmin
      .from('transactions')
      .select('*')
      .gte('date', dateRange.startDate)
      .lte('date', dateRange.endDate)
      .order('date', { ascending: false });

    // Apply reviewed filter
    if (searchParams.reviewed === 'true') {
      query = query.eq('reviewed', true);
    } else if (searchParams.reviewed === 'false') {
      query = query.eq('reviewed', false);
    }

    // Apply search filter
    if (searchParams.search) {
      query = query.or(
        `payee.ilike.%${searchParams.search}%,description.ilike.%${searchParams.search}%`
      );
    }

    // Fetch transactions
    const { data: transactions, error: txError } = await query;

    if (txError) {
      console.error('[Transactions] Query error:', txError);
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return { transactions: [], total: 0 };
    }

    // Collect all unique IDs for batch fetching related data
    const accountIds = [...new Set(transactions.map((t) => t.account_id))];
    const categoryIds = [
      ...new Set(
        transactions
          .map((t) => [t.category_id, t.ai_suggested_category])
          .flat()
          .filter(Boolean) as string[]
      ),
    ];

    // Batch fetch accounts
    const { data: accounts } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type')
      .in('id', accountIds);

    // Batch fetch categories (including AI suggested)
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, name, section, type')
      .in('id', categoryIds);

    // Create lookup maps
    const accountMap = new Map(accounts?.map((a) => [a.id, a]) || []);
    const categoryMap = new Map(categories?.map((c) => [c.id, c]) || []);

    // Enrich transactions with joined data
    const enrichedTransactions = transactions.map((tx) => ({
      ...tx,
      account: tx.account_id ? accountMap.get(tx.account_id) : null,
      category: tx.category_id ? categoryMap.get(tx.category_id) : null,
      ai_suggested: tx.ai_suggested_category
        ? categoryMap.get(tx.ai_suggested_category)
        : null,
    }));

    return {
      transactions: enrichedTransactions,
      total: enrichedTransactions.length,
    };
  } catch (error) {
    console.error('[Transactions] Fatal error:', error);
    return {
      transactions: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { transactions, total, error } = await getTransactions(searchParams);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
        <p className="mt-1 text-sm text-gray-500">
          {searchParams.reviewed === 'false'
            ? 'Review and categorize transactions'
            : searchParams.reviewed === 'true'
            ? 'Reviewed transactions'
            : 'All transactions'}
        </p>
      </div>

      {error && (
        <div className="card border-l-4 border-red-400 bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading transactions
              </h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <TransactionFilters
        currentReviewed={searchParams.reviewed}
        currentRange={searchParams.range || 'last_3_months'}
        currentSearch={searchParams.search}
      />

      {total > 0 && (
        <div className="text-sm text-gray-500">
          Showing {total} transaction{total !== 1 ? 's' : ''}
        </div>
      )}

      <TransactionTable transactions={transactions} />
    </div>
  );
}
