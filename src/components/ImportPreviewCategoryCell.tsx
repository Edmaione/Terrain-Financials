'use client'

import { useState, useRef, useEffect } from 'react'
import { Category } from '@/types'

export interface AISuggestion {
  categoryId: string | null
  categoryName: string | null
  confidence: number
  source: 'rule' | 'ai' | 'pattern'
  ruleId?: string
}

interface ImportPreviewCategoryCellProps {
  rowHash: string
  suggestion?: AISuggestion | null
  override?: string | null
  categories: Category[]
  loading?: boolean
  onOverride: (rowHash: string, categoryId: string, previousSuggestion?: AISuggestion | null) => void
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (confidence >= 0.6) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-rose-600 bg-rose-50 border-rose-200'
}

function getConfidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-emerald-100 text-emerald-700'
  if (confidence >= 0.6) return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

export default function ImportPreviewCategoryCell({
  rowHash,
  suggestion,
  override,
  categories,
  loading = false,
  onOverride,
}: ImportPreviewCategoryCellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null!)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Get the current display value
  const overrideCategory = override ? categories.find((c) => c.id === override) : null
  const displayCategoryId = override || suggestion?.categoryId
  const displayCategoryName = overrideCategory?.name || suggestion?.categoryName
  const isOverridden = Boolean(override && override !== suggestion?.categoryId)

  // Filter categories based on search
  const filteredCategories = searchQuery
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories

  // Group categories by section
  const groupedCategories = filteredCategories.reduce<Record<string, Category[]>>((acc, cat) => {
    const section = cat.section || 'Other'
    if (!acc[section]) acc[section] = []
    acc[section].push(cat)
    return acc
  }, {})

  const handleSelect = (categoryId: string) => {
    onOverride(rowHash, categoryId, suggestion)
    setIsOpen(false)
    setSearchQuery('')
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="h-5 w-24 bg-slate-200 rounded" />
        <div className="h-4 w-8 bg-slate-200 rounded" />
      </div>
    )
  }

  // No suggestion yet
  if (!displayCategoryId) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 px-2 py-1 rounded transition-colors"
        >
          + Add category
        </button>

        {isOpen && (
          <CategoryDropdown
            categories={groupedCategories}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelect={handleSelect}
            inputRef={inputRef}
          />
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
          isOverridden
            ? 'bg-blue-50 border border-blue-200 text-blue-700'
            : suggestion
            ? getConfidenceColor(suggestion.confidence)
            : 'bg-slate-50 text-slate-600'
        } hover:bg-opacity-75`}
      >
        <span className="truncate max-w-[140px]">{displayCategoryName || 'Unknown'}</span>
        {suggestion && !isOverridden && (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getConfidenceBadgeColor(
              suggestion.confidence
            )}`}
          >
            {Math.round(suggestion.confidence * 100)}%
          </span>
        )}
        {isOverridden && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
            edited
          </span>
        )}
      </button>

      {isOpen && (
        <CategoryDropdown
          categories={groupedCategories}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={handleSelect}
          inputRef={inputRef}
          currentCategoryId={displayCategoryId}
        />
      )}
    </div>
  )
}

interface CategoryDropdownProps {
  categories: Record<string, Category[]>
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelect: (categoryId: string) => void
  inputRef: React.RefObject<HTMLInputElement>
  currentCategoryId?: string | null
}

function CategoryDropdown({
  categories,
  searchQuery,
  onSearchChange,
  onSelect,
  inputRef,
  currentCategoryId,
}: CategoryDropdownProps) {
  const sections = Object.keys(categories).sort()
  const hasResults = sections.length > 0

  return (
    <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg">
      <div className="p-2 border-b border-slate-100">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search categories..."
          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400"
        />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {!hasResults && (
          <div className="px-3 py-4 text-xs text-slate-500 text-center">
            No categories found
          </div>
        )}
        {sections.map((section) => (
          <div key={section}>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50 sticky top-0">
              {section}
            </div>
            {categories[section].map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelect(category.id)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                  category.id === currentCategoryId
                    ? 'bg-slate-100 font-medium'
                    : ''
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
