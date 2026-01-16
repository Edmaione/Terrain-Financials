'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconMenu, IconRefresh, IconSearch } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter()
  const [lastUpdated, setLastUpdated] = useState(() => new Date())

  const timeLabel = useMemo(() => {
    return lastUpdated.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [lastUpdated])

  const handleRefresh = () => {
    setLastUpdated(new Date())
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/40 bg-white/80 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-slate-700"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <IconMenu className="h-5 w-5" />
        </Button>
        <div className="relative flex flex-1 items-center">
          <IconSearch className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search transactions, vendors, or categories"
            className="pl-9"
            aria-label="Search"
          />
        </div>
        <div className="hidden items-center gap-3 text-xs text-slate-500 md:flex">
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
            Updated {timeLabel}
          </div>
          <Button variant="secondary" size="sm" onClick={handleRefresh} aria-label="Refresh data" className="text-slate-700">
            <IconRefresh className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="md:hidden text-slate-700"
          onClick={handleRefresh}
          aria-label="Refresh data"
        >
          <IconRefresh className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
