import * as React from 'react'
import { cn } from '@/lib/utils'

const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('animate-pulse rounded-xl bg-slate-200/70', className)} {...props} />
  )
)
Skeleton.displayName = 'Skeleton'

const MetricCardSkeleton = () => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
    <Skeleton className="h-10 w-10 rounded-full" />
    <Skeleton className="mt-4 h-4 w-32" />
    <Skeleton className="mt-3 h-7 w-28" />
    <Skeleton className="mt-2 h-3 w-24" />
  </div>
)

const TableRowSkeleton = () => (
  <div className="grid grid-cols-[32px_120px_1fr_160px_160px_120px_120px_160px] gap-4 px-6 py-4">
    {Array.from({ length: 8 }).map((_, index) => (
      <Skeleton key={index} className="h-4 w-full" />
    ))}
  </div>
)

export { Skeleton, MetricCardSkeleton, TableRowSkeleton }
