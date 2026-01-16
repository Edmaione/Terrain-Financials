import {
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconWallet,
} from '@/components/ui/icons'
import { Card } from '@/components/ui/Card'

export default function DashboardStats({
  currentCash,
  monthlyRevenue,
  monthlyExpenses,
  monthlyProfit,
  unreviewedCount,
}: {
  currentCash: number
  monthlyRevenue: number
  monthlyExpenses: number
  monthlyProfit: number
  unreviewedCount: number
}) {
  const stats = [
    {
      name: 'Current Cash',
      value: `$${currentCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      helper: 'Across active accounts',
      icon: IconWallet,
      tone: 'text-slate-900',
      iconTone: 'bg-slate-100 text-slate-700',
    },
    {
      name: 'Monthly Revenue',
      value: `$${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      helper: 'This month to date',
      icon: IconArrowUpRight,
      tone: 'text-emerald-600',
      iconTone: 'bg-emerald-100 text-emerald-700',
    },
    {
      name: 'Monthly Expenses',
      value: `$${monthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      helper: 'This month to date',
      icon: IconArrowDownRight,
      tone: 'text-rose-600',
      iconTone: 'bg-rose-100 text-rose-700',
    },
    {
      name: 'Unreviewed Transactions',
      value: unreviewedCount.toLocaleString('en-US'),
      helper: unreviewedCount > 0 ? 'Review backlog' : 'All reviewed',
      icon: IconAlertCircle,
      tone: unreviewedCount > 0 ? 'text-amber-600' : 'text-slate-900',
      iconTone: unreviewedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.name} className="p-6">
            <div className="flex items-center justify-between">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${stat.iconTone}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {stat.name}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${stat.tone}`}>{stat.value}</p>
            <p className="mt-2 text-xs text-slate-500">{stat.helper}</p>
          </Card>
        )
      })}
    </div>
  )
}
