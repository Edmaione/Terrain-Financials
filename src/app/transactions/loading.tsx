export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="mt-2 h-4 w-56 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded bg-gray-200 animate-pulse" />
          <div className="h-9 w-28 rounded bg-gray-200 animate-pulse" />
          <div className="h-9 w-28 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>
      <div className="card overflow-hidden p-0">
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="mt-2 h-3 w-24 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="space-y-4 px-6 py-6">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-10 rounded bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
