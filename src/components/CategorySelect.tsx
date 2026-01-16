'use client';

import { useEffect, useState } from 'react';
import { Category } from '@/types';

interface CategorySelectProps {
  value?: string | null;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function CategorySelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select category...',
}: CategorySelectProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/categories');
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to fetch categories');
      }

      setCategories(result.data);
    } catch (err) {
      console.error('[CategorySelect] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  // Group categories by parent
  const parentCategories = categories.filter((c) => !c.parent_id);
  const categoryGroups = parentCategories.map((parent) => ({
    parent,
    children: categories.filter((c) => c.parent_id === parent.id),
  }));

  if (loading) {
    return (
      <select className="input" disabled>
        <option>Loading categories...</option>
      </select>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="input"
    >
      <option value="">{placeholder}</option>
      {categoryGroups.map((group) => (
        <optgroup key={group.parent.id} label={group.parent.name}>
          <option value={group.parent.id}>{group.parent.name}</option>
          {group.children.map((child) => (
            <option key={child.id} value={child.id}>
              &nbsp;&nbsp;→ {child.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
