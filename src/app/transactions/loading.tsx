export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="card space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="skeleton h-4 w-20" />
            <div className="mt-2 skeleton h-3 w-32" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-9 w-24" />
            <div className="skeleton h-9 w-28" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.4fr)]">
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <div className="card overflow-hidden p-0">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="skeleton h-4 w-28" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[40px_120px_1fr_160px_160px_120px_120px_160px] gap-4 px-6 py-4">
              {Array.from({ length: 8 }).map((__, colIndex) => (
                <div key={colIndex} className="skeleton h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
