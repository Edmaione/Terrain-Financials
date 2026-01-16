export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded-full bg-slate-100" />
      </div>

      <div className="card space-y-4">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-8 w-20 animate-pulse rounded-full bg-slate-100" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-8 w-24 animate-pulse rounded-full bg-slate-100" />
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="space-y-3 px-6 py-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
