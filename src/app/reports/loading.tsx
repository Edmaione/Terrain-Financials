export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="card">
        <div className="skeleton h-12 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card">
            <div className="skeleton h-4 w-24" />
            <div className="mt-4 skeleton h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skeleton h-5 w-32" />
        <div className="mt-6 skeleton h-56 w-full" />
      </div>
    </div>
  )
}
