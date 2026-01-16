import { Card } from '@/components/ui/Card'
import { Skeleton, TableRowSkeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card className="space-y-4 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.4fr)]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRowSkeleton key={index} />
          ))}
        </div>
      </Card>
    </div>
  )
}
