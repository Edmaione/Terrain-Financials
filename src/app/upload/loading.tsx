import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card className="max-w-4xl space-y-4 p-5">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-10 w-40" />
      </Card>
    </div>
  )
}
