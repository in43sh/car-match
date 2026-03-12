'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'

type ListingDetail = {
  id: number
  title: string
  price: number | null
  mileage: number | null
  year: number | null
  location: string | null
  fbUrl: string
  imageUrl: string | null
  sellerType: 'private' | 'dealer' | null
  status: 'new' | 'interested' | 'rejected' | 'contacted'
  notes: string | null
  profileName: string | null
  alertedAt: string | null
  createdAt: string
  updatedAt: string
  carfax: CarfaxSummary | null
}

type CarfaxSummary = {
  id: number
  verdict: 'pass' | 'caution' | 'fail' | 'unknown'
  accidentCount: number | null
  ownerCount: number | null
  odometerRollback: boolean | null
  lastOdometer: number | null
  titleIssues: string | null
  verdictReasons: string | null
  parsedAt: string | null
}

const STATUS_OPTIONS = ['new', 'interested', 'contacted', 'rejected'] as const

const STATUS_ACTIVE: Record<string, string> = {
  new:       'border-[#60a5fa] text-[#60a5fa] bg-[#1e3a5f]',
  interested:'border-[#10b981] text-[#10b981] bg-[#064e3b]',
  rejected:  'border-[#f87171] text-[#f87171] bg-[#450a0a]',
  contacted: 'border-[#c084fc] text-[#c084fc] bg-[#3b1d6e]',
}

const VERDICT: Record<string, { label: string; cls: string }> = {
  pass:    { label: '✅ PASS',     cls: 'bg-[#064e3b] text-[#10b981]' },
  caution: { label: '⚠️ CAUTION', cls: 'bg-[#451a03] text-[#fb923c]' },
  fail:    { label: '❌ FAIL',    cls: 'bg-[#450a0a] text-[#f87171]' },
  unknown: { label: '? UNKNOWN',  cls: 'bg-[#1f1f1f] text-[#6b7280]'  },
}

export default function ListingDetailPage({ params }: { params: { id: string } }) {
  const router  = useRouter()
  const id      = parseInt(params.id, 10)
  const fileRef = useRef<HTMLInputElement>(null)

  const [listing, setListing]       = useState<ListingDetail | null>(null)
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [updatingStatus, setUpdating] = useState(false)
  const [notes, setNotes]           = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [carfaxMode, setMode]       = useState<'url' | 'file'>('url')
  const [carfaxUrl, setCarfaxUrl]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setError]     = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/listings/${id}`)
    if (res.status === 404) { setNotFound(true); setLoading(false); return }
    const data = await res.json() as ListingDetail
    setListing(data)
    setNotes(data.notes ?? '')
    setLoading(false)
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus(status: string) {
    if (!listing || updatingStatus) return
    setUpdating(true)
    const res = await fetch(`/api/listings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setListing(prev => prev ? { ...prev, status: status as ListingDetail['status'] } : prev)
    setUpdating(false)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await fetch(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notes || null }),
    })
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function deleteListing() {
    if (!confirm('Delete this listing permanently?')) return
    await fetch(`/api/listings/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  async function submitCarfax(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    let body: Record<string, unknown>
    if (carfaxMode === 'file') {
      const file = fileRef.current?.files?.[0]
      if (!file) { setError('Select an HTML file'); setSubmitting(false); return }
      body = { html: await file.text(), listingId: id }
    } else {
      body = { url: carfaxUrl, listingId: id }
    }

    const res = await fetch('/api/carfax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      await load()
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string }
      setError(err.error ?? 'Submission failed')
    }
    setSubmitting(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-6 text-sm text-[#6b7280]">Loading…</div>

  if (notFound || !listing) {
    return (
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#f0f0f0] mb-4 w-fit">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-[#6b7280] text-sm">Listing not found.</p>
      </div>
    )
  }

  const cf = listing.carfax

  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      {/* Back */}
      <Link href="/" className="flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#f0f0f0] mb-5 w-fit">
        <ArrowLeft className="h-4 w-4" /> All Listings
      </Link>

      {/* Image */}
      {listing.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="w-full max-h-64 object-cover rounded-lg mb-5 bg-[#1f1f1f]"
        />
      )}

      {/* Title + FB link */}
      <div className="flex items-start gap-3 mb-4">
        <h1 className="flex-1 text-xl font-semibold text-[#f0f0f0] leading-tight">{listing.title}</h1>
        <a
          href={listing.fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-[#10b981] border border-[#2a2a2a] rounded px-2 py-1.5 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View on FB
        </a>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
        {[
          { label: 'Price',    value: listing.price    != null ? `$${listing.price.toLocaleString('en-US')}` : '—' },
          { label: 'Year',     value: listing.year?.toString() ?? '—' },
          { label: 'Mileage',  value: listing.mileage  != null ? `${listing.mileage.toLocaleString('en-US')} mi` : '—' },
          { label: 'Location', value: listing.location ?? '—' },
          { label: 'Seller',   value: listing.sellerType ?? '—' },
          { label: 'Profile',  value: listing.profileName ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-xs text-[#6b7280] mb-0.5">{label}</div>
            <div className="text-sm font-mono text-[#f0f0f0] truncate capitalize">{value}</div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="mb-6">
        <div className="text-xs text-[#6b7280] mb-2">Status</div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              disabled={updatingStatus}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize border transition-all disabled:opacity-50 ${
                listing.status === s
                  ? STATUS_ACTIVE[s]
                  : 'border-[#2a2a2a] text-[#6b7280] hover:text-[#f0f0f0] hover:border-[#444]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <div className="text-xs text-[#6b7280] mb-2">Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes about this listing…"
          rows={3}
          className="w-full bg-[#161616] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f0] placeholder-[#4b5563] focus:outline-none focus:border-[#10b981] resize-none"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="px-3 py-1.5 bg-[#1f1f1f] border border-[#2a2a2a] rounded text-xs text-[#f0f0f0] hover:border-[#444] disabled:opacity-50 transition-colors"
          >
            {savingNotes ? 'Saving…' : 'Save'}
          </button>
          {notesSaved && <span className="text-xs text-[#10b981]">Saved</span>}
        </div>
      </div>

      {/* CARFAX */}
      <div className="border border-[#2a2a2a] rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-[#f0f0f0] mb-3">CARFAX Report</h2>

        {cf ? (
          <div className="space-y-3">
            <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${VERDICT[cf.verdict].cls}`}>
              {VERDICT[cf.verdict].label}
            </span>

            <div className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-1.5 text-sm">
              <span className="text-[#6b7280]">Accidents</span>
              <span className="font-mono text-[#f0f0f0]">{cf.accidentCount ?? '—'}</span>
              <span className="text-[#6b7280]">Owners</span>
              <span className="font-mono text-[#f0f0f0]">{cf.ownerCount ?? '—'}</span>
              <span className="text-[#6b7280]">Odometer history</span>
              <span className={`font-mono ${cf.odometerRollback ? 'text-[#f87171]' : 'text-[#f0f0f0]'}`}>
                {cf.odometerRollback ? '⚠ Rollback detected' : 'Clean'}
              </span>
              {cf.lastOdometer != null && (
                <>
                  <span className="text-[#6b7280]">Last reading</span>
                  <span className="font-mono text-[#f0f0f0]">{cf.lastOdometer.toLocaleString('en-US')} mi</span>
                </>
              )}
            </div>

            {cf.verdictReasons && (() => {
              try {
                const reasons = JSON.parse(cf.verdictReasons) as string[]
                if (!reasons.length) return null
                return (
                  <div className="pt-1 space-y-1">
                    {reasons.map((r, i) => <div key={i} className="text-xs text-[#f87171]">• {r}</div>)}
                  </div>
                )
              } catch { return null }
            })()}
          </div>
        ) : (
          <form onSubmit={submitCarfax} className="space-y-3">
            {/* Mode toggle */}
            <div className="flex gap-4 text-xs">
              {(['url', 'file'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`transition-colors ${carfaxMode === m ? 'text-[#10b981]' : 'text-[#6b7280] hover:text-[#f0f0f0]'}`}
                >
                  {m === 'url' ? 'Paste URL' : 'Upload HTML'}
                </button>
              ))}
            </div>

            {carfaxMode === 'url' ? (
              <input
                type="url"
                value={carfaxUrl}
                onChange={e => setCarfaxUrl(e.target.value)}
                placeholder="https://api.carfax.shop/report/view?hash=…"
                className="w-full bg-[#1f1f1f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-[#f0f0f0] placeholder-[#6b7280] focus:outline-none focus:border-[#10b981]"
                required
              />
            ) : (
              <input
                ref={fileRef}
                type="file"
                accept=".html,text/html"
                required
                className="text-sm text-[#6b7280] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-[#1f1f1f] file:text-[#f0f0f0] hover:file:bg-[#2a2a2a] file:cursor-pointer"
              />
            )}

            {submitError && <p className="text-xs text-[#f87171]">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#10b981] text-black text-sm font-semibold rounded hover:bg-[#059669] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Parsing…' : 'Parse Report'}
            </button>
          </form>
        )}
      </div>

      {/* Danger zone */}
      <div className="border border-[#450a0a]/60 rounded-lg p-4">
        <div className="text-xs text-[#6b7280] mb-2">Danger zone</div>
        <button
          onClick={deleteListing}
          className="flex items-center gap-2 text-sm text-[#f87171] hover:text-[#ef4444] transition-colors"
        >
          <Trash2 className="h-4 w-4" /> Delete listing
        </button>
      </div>
    </div>
  )
}
