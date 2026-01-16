import CategoriesManager from '@/components/CategoriesManager'
import PageHeader from '@/components/PageHeader'

export const dynamic = 'force-dynamic'

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Manage category lists used for transaction approvals and reporting."
      />

      <CategoriesManager />
    </div>
  )
}
