'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type CarfaxRow = {
  id: number
  listingId: number | null
  listingTitle: string | null
  carfaxUrl: string
  verdict: 'pass' | 'caution' | 'fail' | 'unknown'
  accidentCount: number | null
  ownerCount: number | null
  odometerRollback: boolean | null
  lastOdometer: number | null
  createdAt: string
}

const VERDICT: Record<string, { label: string; cls: string }> = {
  pass:    { label: 'PASS',    cls: 'bg-[#064e3b] text-[#10b981]' },
  caution: { label: 'CAUTION', cls: 'bg-[#451a03] text-[#fb923c]' },
  fail:    { label: 'FAIL',    cls: 'bg-[#450a0a] text-[#f87171]' },
  unknown: { label: 'UNKNOWN', cls: 'bg-[#1f1f1f] text-[#6b7280]'  },
}

export default function CarfaxHistoryPage() {
  const [rows, setRows]     = useState<CarfaxRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/carfax')
      .then(r => r.json())
      .then((data: CarfaxRow[]) => { setRows(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#f0f0f0]">CARFAX History</h1>
        {!loading && (
          <span className="text-sm text-[#6b7280]">
            {rows.length} report{rows.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[#6b7280]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#6b7280]">
          No CARFAX reports yet. Submit one from a listing detail page.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 lg:-mx-6">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-left text-xs text-[#6b7280] border-b border-[#2a2a2a]">
                <th className="pb-2 px-4 lg:px-6 font-normal">Listing</th>
                <th className="pb-2 pr-4 font-normal">Verdict</th>
                <th className="pb-2 pr-4 font-normal">Accidents</th>
                <th className="pb-2 pr-4 font-normal hidden sm:table-cell">Owners</th>
                <th className="pb-2 pr-4 font-normal hidden md:table-cell">Odometer</th>
                <th className="pb-2 pr-4 font-normal hidden lg:table-cell">Last reading</th>
                <th className="pb-2 pr-4 font-normal hidden xl:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const v = VERDICT[row.verdict]
                return (
                  <tr key={row.id} className="border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors">
                    <td className="py-3 px-4 lg:px-6">
                      {row.listingId ? (
                        <Link
                          href={`/listings/${row.listingId}`}
                          className="text-[#f0f0f0] hover:text-[#10b981] transition-colors line-clamp-1"
                        >
                          {row.listingTitle ?? `Listing #${row.listingId}`}
                        </Link>
                      ) : (
                        <span className="text-[#6b7280]">Standalone</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${v.cls}`}>
                        {v.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-[#f0f0f0]">
                      {row.accidentCount ?? '—'}
                    </td>
                    <td className="py-3 pr-4 font-mono text-[#f0f0f0] hidden sm:table-cell">
                      {row.ownerCount ?? '—'}
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell">
                      {row.odometerRollback
                        ? <span className="text-xs text-[#f87171]">⚠ Rollback</span>
                        : <span className="text-xs text-[#6b7280]">Clean</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-[#6b7280] hidden lg:table-cell">
                      {row.lastOdometer != null ? `${row.lastOdometer.toLocaleString('en-US')} mi` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#6b7280] whitespace-nowrap hidden xl:table-cell">
                      {new Date(row.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
