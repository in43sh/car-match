'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

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
  matchedProfileCount: number
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

const EMPTY_FORM = { fbUrl: '', title: '', price: '', mileage: '', year: '', location: '', sellerType: '' }

export default function ListingsPage() {
  const router = useRouter()
  const [tab, setTab]         = useState<Tab>('new')
  const [rows, setRows]       = useState<ListingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [formError, setFormError] = useState('')

  function loadRows() {
    setLoading(true)
    const qs = tab === 'all' ? 'limit=200' : `status=${tab}&limit=200`
    fetch(`/api/listings?${qs}`)
      .then(r => r.json())
      .then((data: ListingRow[]) => { setRows(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadRows() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddListing(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const payload: Record<string, unknown> = {
      fbUrl: form.fbUrl,
      title: form.title,
    }
    if (form.price)      payload.price      = parseInt(form.price, 10)
    if (form.mileage)    payload.mileage    = parseInt(form.mileage, 10)
    if (form.year)       payload.year       = parseInt(form.year, 10)
    if (form.location)   payload.location   = form.location
    if (form.sellerType) payload.sellerType = form.sellerType

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const { listing } = await res.json() as { listing: { id: number } }
      setShowForm(false)
      setForm(EMPTY_FORM)
      router.push(`/listings/${listing.id}`)
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string }
      setFormError(err.error ?? 'Failed to add listing')
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-1.5 bg-[#1f1f1f] border border-[#2a2a2a] rounded-sm text-sm text-[#f0f0f0] placeholder-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]'
  const labelCls = 'block text-xs text-[#6b7280] mb-1'

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-[#f0f0f0]">Listings</h1>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-sm text-[#6b7280]">
              {rows.length} listing{rows.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => { setShowForm(true); setFormError('') }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-sm font-medium rounded-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> Add listing
          </button>
        </div>
      </div>

      {/* Add listing form */}
      {showForm && (
        <div className="mb-6 border border-[#2a2a2a] rounded-lg bg-[#161616]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
            <h2 className="text-sm font-semibold text-[#f0f0f0]">Add listing manually</h2>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError('') }} className="text-[#6b7280] hover:text-[#f0f0f0]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleAddListing} className="px-5 py-4 space-y-4">
            <div>
              <label className={labelCls}>Facebook Marketplace URL *</label>
              <input className={inputCls} value={form.fbUrl} onChange={e => setForm(f => ({ ...f, fbUrl: e.target.value }))} required placeholder="https://www.facebook.com/marketplace/item/…" />
            </div>
            <div>
              <label className={labelCls}>Title *</label>
              <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="2019 Toyota Camry SE" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Price ($)</label>
                <input className={inputCls} type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="14500" />
              </div>
              <div>
                <label className={labelCls}>Mileage</label>
                <input className={inputCls} type="number" min="0" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} placeholder="87000" />
              </div>
              <div>
                <label className={labelCls}>Year</label>
                <input className={inputCls} type="number" min="1900" max="2030" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2019" />
              </div>
              <div>
                <label className={labelCls}>Seller</label>
                <select className={inputCls} value={form.sellerType} onChange={e => setForm(f => ({ ...f, sellerType: e.target.value }))}>
                  <option value="">Unknown</option>
                  <option value="private">Private</option>
                  <option value="dealer">Dealer</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input className={inputCls} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Tampa, FL" />
            </div>
            {formError && <p className="text-sm text-[#ef4444]">{formError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white text-sm font-medium rounded-sm transition-colors">
                {saving ? 'Saving…' : 'Add listing'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError('') }} className="px-4 py-1.5 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#f0f0f0] text-sm rounded-sm transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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
                  <td className="py-3 pr-4 hidden lg:table-cell max-w-[140px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[#6b7280] truncate">{row.profileName ?? '—'}</span>
                      {row.matchedProfileCount > 1 && (
                        <span className="shrink-0 text-[10px] font-medium px-1 py-0.5 rounded bg-[#1e3a5f] text-[#60a5fa]" title={`Matched by ${row.matchedProfileCount} profiles`}>
                          +{row.matchedProfileCount - 1}
                        </span>
                      )}
                    </div>
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
