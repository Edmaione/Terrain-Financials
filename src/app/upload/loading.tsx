export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-9 w-56" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="card max-w-4xl space-y-4">
        <div className="skeleton h-48 w-full" />
        <div className="skeleton h-12 w-1/2" />
        <div className="skeleton h-10 w-40" />
      </div>
    </div>
  )
}
