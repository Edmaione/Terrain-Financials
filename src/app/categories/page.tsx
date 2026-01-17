import CategoriesManager from '@/components/CategoriesManager'
import PageHeader from '@/components/PageHeader'

export const dynamic = 'force-dynamic'

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        label="Categories"
        title="Category management"
        description="Manage category lists used for transaction approvals and reporting."
      />

      <div className="rounded-2xl bg-emerald-600 p-4 text-sm font-semibold text-white shadow-sm">
        {/* TEMP: remove after verification */}
        Tailwind is working — rounded, colored, and shadowed.
      </div>

      <CategoriesManager />
    </div>
  )
}
