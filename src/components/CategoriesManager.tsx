'use client';

import { useEffect, useMemo, useState } from 'react';
import AlertBanner from '@/components/AlertBanner';
import { apiRequest } from '@/lib/api-client';
import { Category } from '@/types';

const TYPE_OPTIONS = [
  { value: 'income', label: 'Income' },
  { value: 'cogs', label: 'Cost of Goods Sold' },
  { value: 'expense', label: 'Expense' },
  { value: 'other_income', label: 'Other Income' },
  { value: 'other_expense', label: 'Other Expense' },
];

const emptyForm = {
  name: '',
  type: 'expense',
  section: '',
  parent_id: '',
  sort_order: 0,
};

export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formState, setFormState] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);

  const parentOptions = useMemo(
    () => categories.filter((category) => !category.parent_id),
    [categories]
  );

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Category[]>('/api/categories');
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormState({ ...emptyForm });
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        name: formState.name.trim(),
        type: formState.type,
        section: formState.section.trim() || null,
        parent_id: formState.parent_id || null,
        sort_order: Number(formState.sort_order) || 0,
      };

      if (!payload.name) {
        throw new Error('Category name is required.');
      }

      if (editingId) {
        await apiRequest(`/api/categories/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess('Category updated.');
      } else {
        await apiRequest('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSuccess('Category created.');
      }

      resetForm();
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category.');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setFormState({
      name: category.name,
      type: category.type,
      section: category.section || '',
      parent_id: category.parent_id || '',
      sort_order: category.sort_order || 0,
    });
  };

  const handleDelete = async (category: Category) => {
    setError(null);
    setSuccess(null);

    const confirmed = window.confirm(`Delete ${category.name}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await apiRequest(`/api/categories/${category.id}`, {
        method: 'DELETE',
      });
      setSuccess('Category deleted.');
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Category Manager</h2>
            <p className="text-sm text-slate-500">
              Create, organize, and retire categories used across transactions.
            </p>
          </div>
          {editingId && (
            <button type="button" onClick={resetForm} className="btn-secondary">
              Cancel edit
            </button>
          )}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="category-name">
              Name
            </label>
            <input
              id="category-name"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              className="input w-full"
              placeholder="e.g. Fuel"
            />
          </div>
          <div>
            <label className="label" htmlFor="category-type">
              Type
            </label>
            <select
              id="category-type"
              value={formState.type}
              onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value }))}
              className="input w-full"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="category-section">
              Section
            </label>
            <input
              id="category-section"
              value={formState.section}
              onChange={(event) => setFormState((prev) => ({ ...prev, section: event.target.value }))}
              className="input w-full"
              placeholder="e.g. ADMIN"
            />
          </div>
          <div>
            <label className="label" htmlFor="category-parent">
              Parent category
            </label>
            <select
              id="category-parent"
              value={formState.parent_id}
              onChange={(event) => setFormState((prev) => ({ ...prev, parent_id: event.target.value }))}
              className="input w-full"
            >
              <option value="">None</option>
              {parentOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="category-sort">
              Sort order
            </label>
            <input
              id="category-sort"
              type="number"
              value={formState.sort_order}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, sort_order: Number(event.target.value) }))
              }
              className="input w-full"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleSubmit} className="btn-primary">
            {editingId ? 'Save changes' : 'Create category'}
          </button>
          {success && <span className="text-sm text-emerald-600">{success}</span>}
        </div>
      </div>

      {error && <AlertBanner variant="error" title="Action failed" message={error} />}

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">All categories</h2>
            <p className="text-sm text-slate-500">{categories.length} total</p>
          </div>
          <button type="button" onClick={fetchCategories} className="btn-secondary">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-6 text-sm text-slate-500">Loading categories…</div>
        ) : categories.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            No categories yet. Create your first category to start organizing transactions.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Section</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Parent</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Sort</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50">
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
                        <button
                          type="button"
                          onClick={() => handleEdit(category)}
                          className="btn-secondary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
                          className="btn-secondary"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
