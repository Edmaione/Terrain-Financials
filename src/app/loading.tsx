export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card">
            <div className="skeleton h-4 w-24" />
            <div className="mt-4 skeleton h-8 w-32" />
            <div className="mt-2 skeleton h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skeleton h-4 w-32" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="card-muted">
              <div className="skeleton h-4 w-20" />
              <div className="mt-3 skeleton h-6 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
