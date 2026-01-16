export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-4 w-32" />
            <div className="mt-2 skeleton h-3 w-48" />
          </div>
          <div className="skeleton h-9 w-28" />
        </div>
      </div>
      <div className="card">
        <div className="skeleton h-8 w-full" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton h-6 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
