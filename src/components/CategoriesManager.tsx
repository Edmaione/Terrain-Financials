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
import { useToast } from '@/components/ui/Toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

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
  const [formError, setFormError] = useState<string | null>(null)
  const [formState, setFormState] = useState({ ...emptyForm })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const { toast } = useToast()

  const parentOptions = useMemo(
    () => categories.filter((category) => !category.parent_id),
    [categories]
  )

  const filteredCategories = useMemo(() => {
    if (!searchValue.trim()) {
      return categories
    }
    const query = searchValue.trim().toLowerCase()
    return categories.filter((category) => {
      return (
        category.name.toLowerCase().includes(query) ||
        category.section?.toLowerCase().includes(query) ||
        category.type.toLowerCase().includes(query)
      )
    })
  }, [categories, searchValue])

  const fetchCategories = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<Category[]>('/api/categories')
      setCategories(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load categories.'
      setError(message)
      toast({
        variant: 'error',
        title: 'Categories unavailable',
        description: message,
      })
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
    setFormError(null)
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
    setFormError(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setError(null)
    setFormError(null)
  }

  const handleSubmit = async () => {
    setFormError(null)

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
        toast({
          variant: 'success',
          title: 'Category updated',
          description: 'Your changes have been saved.',
        })
      } else {
        await apiRequest('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        toast({
          variant: 'success',
          title: 'Category created',
          description: 'The new category is ready to use.',
        })
      }

      closeModal()
      resetForm()
      await fetchCategories()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save category.'
      setFormError(message)
      toast({
        variant: 'error',
        title: 'Save failed',
        description: message,
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteError(null)

    try {
      await apiRequest(`/api/categories/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      toast({
        variant: 'success',
        title: 'Category deleted',
        description: 'The category has been removed.',
      })
      setDeleteTarget(null)
      await fetchCategories()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete category.'
      setDeleteError(message)
      toast({
        variant: 'error',
        title: 'Delete failed',
        description: message,
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Category Manager</h2>
            <p className="text-sm text-slate-500">
              Create, organize, and retire categories used across transactions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={fetchCategories}>
              <IconRefresh className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={openCreateModal}>
              <IconPlusCircle className="h-4 w-4" />
              New category
            </Button>
          </div>
        </div>
      </Card>

      {error && <AlertBanner variant="error" title="Action failed" message={error} />}

      <Card className="p-0">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">All categories</h2>
            <p className="text-xs text-slate-500">{filteredCategories.length} total</p>
          </div>
          <div className="w-full sm:w-64">
            <Input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search categories"
              aria-label="Search categories"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-500">
            No categories yet. Create your first category to start organizing transactions.
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-500">
            No categories match your search. Try a different keyword.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead className="text-right">Sort</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="text-slate-900">
                      <div className="font-medium">{category.name}</div>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {category.section || 'N/A'}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {TYPE_OPTIONS.find((option) => option.value === category.type)?.label ?? category.type}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {category.parent_id
                        ? parentOptions.find((parent) => parent.id === category.parent_id)?.name || 'N/A'
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right text-slate-500">
                      {category.sort_order ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
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

            {formError && <p className="mt-4 text-sm text-rose-600">{formError}</p>}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-900">Delete category</h3>
            <p className="mt-2 text-sm text-slate-500">
              Deleting <span className="font-semibold text-slate-700">{deleteTarget.name}</span> will remove it from future selections. Categories assigned to transactions must be reassigned before deletion.
            </p>
            {deleteError && <p className="mt-3 text-sm text-rose-600">{deleteError}</p>}
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
