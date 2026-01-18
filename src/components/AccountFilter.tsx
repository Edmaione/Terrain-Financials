'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AccountSummary } from '@/types'
import { AccountCard } from '@/components/AccountCard'

type AccountFilterProps = {
  summaries: AccountSummary[]
  allSummary: AccountSummary
  selectedAccountId?: string | null
}

export default function AccountFilter({
  summaries,
  allSummary,
  selectedAccountId,
}: AccountFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateAccount = (accountId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('account_id', accountId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-700">Accounts</div>
          <div className="text-xs text-slate-500">Filter transactions by account</div>
        </div>
        <button
          type="button"
          onClick={() => updateAccount('all')}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
        >
          View all
        </button>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        <AccountCard
          account={allSummary.account}
          balance={allSummary.balance}
          isSelected={selectedAccountId === 'all'}
          pendingCount={allSummary.pending_count}
          unreviewedCount={allSummary.unreviewed_count}
          lastUpdate={allSummary.last_transaction_date}
          onClick={() => updateAccount('all')}
        />
        {summaries.map((summary) => (
          <AccountCard
            key={summary.account.id}
            account={summary.account}
            balance={summary.balance}
            isSelected={selectedAccountId === summary.account.id}
            pendingCount={summary.pending_count}
            unreviewedCount={summary.unreviewed_count}
            lastUpdate={summary.last_transaction_date}
            onClick={() => updateAccount(summary.account.id)}
          />
        ))}
      </div>
    </div>
  )
}
