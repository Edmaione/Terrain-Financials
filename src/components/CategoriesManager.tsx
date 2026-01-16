'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconPlusCircle, IconRefresh } from '@/components/ui/icons'
import AlertBanner from '@/components/AlertBanner'
import { apiRequest } from '@/lib/api-client'
import { Category } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const TYPE_OPTIONS = [
  { value: 'income', label: 'Income' },
  { value: 'cogs', label: 'Cost of Goods Sold' },
  { value: 'expense', label: 'Expense' },
  { value: 'other_income', label: 'Other Income' },
  { value: 'other_expense', label: 'Other Expense' },
]

const emptyForm = {
  name: '',
  type: 'expense',
  section: '',
  parent_id: '',
  sort_order: 0,
}

export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formState, setFormState] = useState({ ...emptyForm })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const parentOptions = useMemo(
    () => categories.filter((category) => !category.parent_id),
    [categories]
  )

  const fetchCategories = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<Category[]>('/api/categories')
      setCategories(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setFormState({ ...emptyForm })
  }

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (category: Category) => {
    setEditingId(category.id)
    setFormState({
      name: category.name,
      type: category.type,
      section: category.section || '',
      parent_id: category.parent_id || '',
      sort_order: category.sort_order || 0,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        name: formState.name.trim(),
        type: formState.type,
        section: formState.section.trim() || null,
        parent_id: formState.parent_id || null,
        sort_order: Number(formState.sort_order) || 0,
      }

      if (!payload.name) {
        throw new Error('Category name is required.')
      }

      if (editingId) {
        await apiRequest(`/api/categories/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        setSuccess('Category updated.')
      } else {
        await apiRequest('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        setSuccess('Category created.')
      }

      closeModal()
      resetForm()
      await fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setError(null)
    setSuccess(null)

    try {
      await apiRequest(`/api/categories/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      setSuccess('Category deleted.')
      setDeleteTarget(null)
      await fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category.')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Category Manager</h2>
            <p className="text-sm text-slate-500">
              Create, organize, and retire categories used across transactions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={fetchCategories} className="text-slate-700">
              <IconRefresh className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={openCreateModal} className="text-white">
              <IconPlusCircle className="h-4 w-4" />
              New category
            </Button>
          </div>
        </div>
        {success && <p className="mt-4 text-sm font-medium text-emerald-600">{success}</p>}
      </Card>

      {error && <AlertBanner variant="error" title="Action failed" message={error} />}

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">All categories</h2>
            <p className="text-sm text-slate-500">{categories.length} total</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 text-sm text-slate-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            No categories yet. Create your first category to start organizing transactions.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Section</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Parent</th>
                  <th className="px-4 py-3 text-right">Sort</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {categories.map((category) => (
                  <tr key={category.id} className="border-b border-slate-100 text-sm text-slate-700 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">
                      <div className="font-medium">{category.name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {category.section || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {TYPE_OPTIONS.find((option) => option.value === category.type)?.label ?? category.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {category.parent_id
                        ? parentOptions.find((parent) => parent.id === category.parent_id)?.name || 'N/A'
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500">
                      {category.sort_order ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(category)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(category)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingId ? 'Edit category' : 'New category'}
                </h3>
                <p className="text-sm text-slate-500">
                  {editingId ? 'Update category details and hierarchy.' : 'Create a new category for transactions.'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Close
              </Button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="category-name">
                  Name
                </label>
                <Input
                  id="category-name"
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. Fuel"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="category-type">
                  Type
                </label>
                <Select
                  id="category-type"
                  value={formState.type}
                  onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value }))}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="category-section">
                  Section
                </label>
                <Input
                  id="category-section"
                  value={formState.section}
                  onChange={(event) => setFormState((prev) => ({ ...prev, section: event.target.value }))}
                  placeholder="e.g. ADMIN"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="category-parent">
                  Parent category
                </label>
                <Select
                  id="category-parent"
                  value={formState.parent_id}
                  onChange={(event) => setFormState((prev) => ({ ...prev, parent_id: event.target.value }))}
                >
                  <option value="">None</option>
                  {parentOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="category-sort">
                  Sort order
                </label>
                <Input
                  id="category-sort"
                  type="number"
                  value={formState.sort_order}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, sort_order: Number(event.target.value) }))
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSubmit}>
                {editingId ? 'Save changes' : 'Create category'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-900">Delete category</h3>
            <p className="mt-2 text-sm text-slate-500">
              Deleting <span className="font-semibold text-slate-700">{deleteTarget.name}</span> will remove it from future selections. Existing transactions keep their assigned category.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Delete category
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
