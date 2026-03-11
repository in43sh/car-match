'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Car, Settings, FileText, Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { href: '/',         label: 'Listings',       icon: Car },
  { href: '/profiles', label: 'Profiles',        icon: Settings },
  { href: '/carfax',   label: 'Carfax History',  icon: FileText },
] as const

function ScraperStatus() {
  const [status, setStatus] = useState<'active' | 'error' | 'idle' | null>(null)

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setStatus(d.scraper))
      .catch(() => setStatus('error'))
  }, [])

  if (!status) return null

  const color = status === 'active' ? 'bg-accent-emerald' : status === 'error' ? 'bg-accent-red' : 'bg-[#6b7280]'
  const label = status === 'active' ? 'Active' : status === 'error' ? 'Error' : 'Idle'

  return (
    <div className="flex items-center gap-2 text-xs text-[#6b7280]">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>Scraper: {label}</span>
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
