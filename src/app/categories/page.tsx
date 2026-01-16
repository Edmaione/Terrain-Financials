import CategoriesManager from '@/components/CategoriesManager'

export const dynamic = 'force-dynamic'

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900">Categories</h1>
        <p className="text-sm text-slate-500">
          Manage category lists used for transaction approvals and reporting.
        </p>
      </div>

      <CategoriesManager />
    </div>
  )
}
