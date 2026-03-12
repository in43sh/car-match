'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Car, Settings, FileText, Menu, X } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

const NAV_ITEMS = [
  { href: '/',         label: 'Listings',       icon: Car },
  { href: '/profiles', label: 'Profiles',        icon: Settings },
  { href: '/carfax',   label: 'Carfax History',  icon: FileText },
] as const

type StatusData = {
  scraper: 'active' | 'error' | 'idle'
  lastRunAt: string | null
  nextRunAt: string | null
  lastError?: string
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)  return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

function timeUntil(iso: string): string {
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000)
  if (secs <= 0)  return 'any moment'
  if (secs < 60)  return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  return `${Math.floor(secs / 3600)}h`
}

function ScraperStatus() {
  const [data, setData] = useState<StatusData | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = useCallback(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then((d: StatusData) => {
        setData(d)
        // Schedule next poll: aligned to nextRunAt when healthy, 60s on error
        let delayMs = 60_000
        if (d.scraper !== 'error' && d.nextRunAt) {
          const msUntilNext = new Date(d.nextRunAt).getTime() - Date.now()
          if (msUntilNext > 0) delayMs = msUntilNext + 5_000
        }
        timerRef.current = setTimeout(poll, Math.max(15_000, Math.min(delayMs, 10 * 60_000)))
      })
      .catch(() => {
        setData(prev => prev ? { ...prev, scraper: 'error' } : null)
        timerRef.current = setTimeout(poll, 60_000)
      })
  }, [])

  useEffect(() => {
    poll()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [poll])

  if (!data) return null

  const dot   = data.scraper === 'active' ? 'bg-accent-emerald' : data.scraper === 'error' ? 'bg-accent-red' : 'bg-[#6b7280]'
  const label = data.scraper === 'active' ? 'Active' : data.scraper === 'error' ? 'Error' : 'Idle'

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-[#6b7280]">
        <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
        <span>Scraper: {label}</span>
      </div>
      {data.lastRunAt && (
        <div className="text-xs text-[#4b5563] pl-4">
          Last run: {timeAgo(data.lastRunAt)}
        </div>
      )}
      {data.scraper !== 'error' && data.nextRunAt && (
        <div className="text-xs text-[#4b5563] pl-4">
          Next: in {timeUntil(data.nextRunAt)}
        </div>
      )}
      {data.scraper === 'error' && data.lastError && (
        <div className="text-xs text-[#f87171] pl-4 leading-tight break-words">
          {data.lastError}
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar (desktop) ──────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 border-r border-[#2a2a2a] bg-[#161616]">
        <div className="px-5 py-4 border-b border-[#2a2a2a]">
          <span className="text-lg font-semibold tracking-tight text-[#f0f0f0]">CarMatch</span>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-[#1f1f1f] text-[#f0f0f0]'
                    : 'text-[#6b7280] hover:bg-[#1f1f1f] hover:text-[#f0f0f0]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-5 py-4 border-t border-[#2a2a2a]">
          <ScraperStatus />
        </div>
      </aside>

      {/* ── Sidebar (tablet — icon only) ───────────────────────────────── */}
      <aside className="hidden md:flex lg:hidden flex-col w-14 shrink-0 border-r border-[#2a2a2a] bg-[#161616] items-center">
        <div className="py-4 border-b border-[#2a2a2a] w-full flex justify-center">
          <span className="text-sm font-bold text-[#10b981]">CM</span>
        </div>
        <nav className="flex-1 py-3 space-y-1 w-full px-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex justify-center py-2.5 rounded-md transition-colors ${
                  active ? 'bg-[#1f1f1f] text-[#f0f0f0]' : 'text-[#6b7280] hover:bg-[#1f1f1f] hover:text-[#f0f0f0]'
                }`}
              >
                <Icon className="h-4 w-4" />
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* ── Mobile top bar ─────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-12 bg-[#161616] border-b border-[#2a2a2a]">
        <span className="text-sm font-semibold text-[#f0f0f0]">CarMatch</span>
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="text-[#6b7280] hover:text-[#f0f0f0]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-[#0f0f0f]/80" onClick={() => setMobileOpen(false)}>
          <nav
            className="absolute top-12 left-0 right-0 bg-[#161616] border-b border-[#2a2a2a] px-2 py-2 space-y-0.5"
            onClick={e => e.stopPropagation()}
          >
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-[#f0f0f0] hover:bg-[#1f1f1f]"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto md:pt-0 pt-12">
        {children}
      </main>
    </div>
  )
}
