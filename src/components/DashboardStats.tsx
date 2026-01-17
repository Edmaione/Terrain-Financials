import {
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconWallet,
} from '@/components/ui/icons'
import { Card } from '@/design-system/components/Card'
import { borderRadius, colors, typography } from '@/design-system/tokens'
import { tokenVar } from '@/design-system/utils'

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
      tone: tokenVar('gray-900', colors.gray[900]),
      iconTone: {
        backgroundColor: tokenVar('gray-100', colors.gray[100]),
        color: tokenVar('gray-700', colors.gray[700]),
      },
    },
    {
      name: 'Monthly Revenue',
      value: `$${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      helper: 'This month to date',
      icon: IconArrowUpRight,
      tone: tokenVar('success', colors.success),
      iconTone: {
        backgroundColor: tokenVar('primary-100', colors.primary[100]),
        color: tokenVar('primary-700', colors.primary[700]),
      },
    },
    {
      name: 'Monthly Expenses',
      value: `$${monthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      helper: 'This month to date',
      icon: IconArrowDownRight,
      tone: tokenVar('error', colors.error),
      iconTone: {
        backgroundColor: tokenVar('error-soft', colors.gray[100]),
        color: tokenVar('error', colors.error),
      },
    },
    {
      name: 'Unreviewed Transactions',
      value: unreviewedCount.toLocaleString('en-US'),
      helper: unreviewedCount > 0 ? 'Review backlog' : 'All reviewed',
      icon: IconAlertCircle,
      tone:
        unreviewedCount > 0
          ? tokenVar('warning', colors.warning)
          : tokenVar('gray-900', colors.gray[900]),
      iconTone:
        unreviewedCount > 0
          ? {
              backgroundColor: tokenVar('warning-soft', colors.gray[100]),
              color: tokenVar('warning', colors.warning),
            }
          : {
              backgroundColor: tokenVar('gray-100', colors.gray[100]),
              color: tokenVar('gray-700', colors.gray[700]),
            },
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.name} padding={5}>
            <div className="flex items-center justify-between">
              <div
                className="flex h-9 w-9 items-center justify-center"
                style={{
                  borderRadius: borderRadius.base,
                  ...stat.iconTone,
                }}
              >
                <Icon className="h-[18px] w-[18px]" />
              </div>
            </div>
            <p
              className="mt-3 uppercase tracking-wider"
              style={{
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.semibold,
                color: tokenVar('gray-500', colors.gray[500]),
              }}
            >
              {stat.name}
            </p>
            <p
              className="mt-1.5 text-xl font-semibold"
              style={{ color: stat.tone }}
            >
              {stat.value}
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: tokenVar('gray-500', colors.gray[500]) }}
            >
              {stat.helper}
            </p>
          </Card>
        )
      })}
    </div>
  )
}
