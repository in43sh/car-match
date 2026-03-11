'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type ListingRow = {
  id: number
  title: string
  price: number | null
  mileage: number | null
  year: number | null
  location: string | null
  imageUrl: string | null
  status: 'new' | 'interested' | 'rejected' | 'contacted'
  profileName: string | null
  createdAt: string
}

const TABS = ['all', 'new', 'interested', 'contacted', 'rejected'] as const
type Tab = typeof TABS[number]

const STATUS_BADGE: Record<string, string> = {
  new:       'bg-[#1e3a5f] text-[#60a5fa]',
  interested:'bg-[#064e3b] text-[#10b981]',
  rejected:  'bg-[#450a0a] text-[#f87171]',
  contacted: 'bg-[#3b1d6e] text-[#c084fc]',
}

export default function ListingsPage() {
  const router = useRouter()
  const [tab, setTab]     = useState<Tab>('new')
  const [rows, setRows]   = useState<ListingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = tab === 'all' ? 'limit=200' : `status=${tab}&limit=200`
    fetch(`/api/listings?${qs}`)
      .then(r => r.json())
      .then((data: ListingRow[]) => { setRows(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tab])

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#f0f0f0]">Listings</h1>
        {!loading && (
          <span className="text-sm text-[#6b7280]">
            {rows.length} listing{rows.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2a2a2a] mb-5">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-[#10b981] text-[#10b981]'
                : 'border-transparent text-[#6b7280] hover:text-[#f0f0f0]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 text-center text-sm text-[#6b7280]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#6b7280]">No listings found.</div>
      ) : (
        <div className="overflow-x-auto -mx-4 lg:-mx-6">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="text-left text-xs text-[#6b7280] border-b border-[#2a2a2a]">
                <th className="pb-2 px-4 lg:px-6 font-normal">Vehicle</th>
                <th className="pb-2 pr-4 font-normal">Price</th>
                <th className="pb-2 pr-4 font-normal hidden sm:table-cell">Mileage</th>
                <th className="pb-2 pr-4 font-normal hidden md:table-cell">Location</th>
                <th className="pb-2 pr-4 font-normal">Status</th>
                <th className="pb-2 pr-4 font-normal hidden lg:table-cell">Profile</th>
                <th className="pb-2 pr-4 font-normal hidden xl:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/listings/${row.id}`)}
                  className="border-b border-[#1a1a1a] hover:bg-[#161616] cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 lg:px-6">
                    <div className="flex items-center gap-3">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.imageUrl}
                          alt={row.title}
                          className="h-10 w-14 object-cover rounded shrink-0 bg-[#1f1f1f]"
                        />
                      ) : (
                        <div className="h-10 w-14 rounded bg-[#1f1f1f] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[#f0f0f0] font-medium leading-tight truncate">{row.title}</div>
                        {row.year && <div className="text-xs text-[#6b7280]">{row.year}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-[#f0f0f0] whitespace-nowrap">
                    {row.price != null ? `$${row.price.toLocaleString('en-US')}` : '—'}
                  </td>
                  <td className="py-3 pr-4 font-mono text-[#6b7280] whitespace-nowrap hidden sm:table-cell">
                    {row.mileage != null ? `${row.mileage.toLocaleString('en-US')} mi` : '—'}
                  </td>
                  <td className="py-3 pr-4 text-[#6b7280] hidden md:table-cell max-w-[140px] truncate">
                    {row.location ?? '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_BADGE[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-[#6b7280] hidden lg:table-cell max-w-[120px] truncate">
                    {row.profileName ?? '—'}
                  </td>
                  <td className="py-3 pr-4 text-xs text-[#6b7280] whitespace-nowrap hidden xl:table-cell">
                    {new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
