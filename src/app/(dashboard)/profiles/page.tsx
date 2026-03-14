'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import type { SearchProfile } from '@/db/schema'

// ─── Brand options ────────────────────────────────────────────────────────────

const BRANDS = [
  { value: 'toyota',   label: 'Toyota' },
  { value: 'honda',    label: 'Honda' },
  { value: 'mazda',    label: 'Mazda' },
  { value: 'nissan',   label: 'Nissan' },
  { value: 'lexus',    label: 'Lexus' },
  { value: 'infiniti', label: 'Infiniti' },
  { value: 'acura',    label: 'Acura' },
]

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  name: string
  make: string
  model: string
  modelText: string
  minYear: string
  maxPrice: string
  maxMileage: string
  location: string
  radiusMiles: string
  includePrivate: boolean
  includeDealers: boolean
  japaneseOnly: boolean
  isActive: boolean
  quietEnabled: boolean
  quietFrom: string
  quietUntil: string
}

const DEFAULT_FORM: FormState = {
  name: '',
  make: '',
  model: '',
  modelText: '',
  minYear: '',
  maxPrice: '',
  maxMileage: '',
  location: '',
  radiusMiles: '50',
  includePrivate: true,
  includeDealers: true,
  japaneseOnly: true,
  isActive: true,
  quietEnabled: false,
  quietFrom: '22',
  quietUntil: '7',
}

function profileToForm(p: SearchProfile): FormState {
  return {
    name:           p.name,
    make:           p.make ?? '',
    model:          p.model ?? '',
    modelText:      p.modelText ?? '',
    minYear:        p.minYear?.toString() ?? '',
    maxPrice:       p.maxPrice?.toString() ?? '',
    maxMileage:     p.maxMileage?.toString() ?? '',
    location:       p.location,
    radiusMiles:    p.radiusMiles.toString(),
    includePrivate: p.includePrivate,
    includeDealers: p.includeDealers,
    japaneseOnly:   p.japaneseOnly,
    isActive:       p.isActive,
    quietEnabled:   p.quietFrom !== null && p.quietUntil !== null,
    quietFrom:      p.quietFrom?.toString() ?? '22',
    quietUntil:     p.quietUntil?.toString() ?? '7',
  }
}

// ─── Summary line ─────────────────────────────────────────────────────────────

function formatHour(h: number) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function ProfileSummary({ p }: { p: SearchProfile }) {
  const parts: string[] = []
  if (p.make) parts.push(p.make.charAt(0).toUpperCase() + p.make.slice(1))
  else if (p.japaneseOnly) parts.push('Japanese brands')
  else parts.push('Any make')
  if (p.modelText) parts.push(p.modelText)
  if (p.maxPrice)   parts.push(`≤ $${p.maxPrice.toLocaleString()}`)
  if (p.maxMileage) parts.push(`≤ ${p.maxMileage.toLocaleString()} mi`)
  if (p.minYear)    parts.push(`≥ ${p.minYear}`)
  parts.push(p.location)
  if (p.quietFrom !== null && p.quietUntil !== null) {
    parts.push(`quiet ${formatHour(p.quietFrom)}–${formatHour(p.quietUntil)}`)
  }
  return <span className="text-xs text-[#6b7280] font-mono">{parts.join(' · ')}</span>
}

// ─── Profile form ─────────────────────────────────────────────────────────────

function ProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: FormState
  onSave: (data: FormState) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof FormState, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-1.5 bg-[#1f1f1f] border border-[#2a2a2a] rounded-sm text-sm text-[#f0f0f0] placeholder-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]'
  const labelCls = 'block text-xs text-[#6b7280] mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className={labelCls}>Name *</label>
        <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Toyota Camry < 15k" />
      </div>

      {/* Make + Model */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Make</label>
          <select className={inputCls} value={form.make} onChange={e => set('make', e.target.value)}>
            <option value="">Any</option>
            {BRANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Facebook Model ID</label>
          <input className={inputCls} value={form.model} onChange={e => set('model', e.target.value)} placeholder="FB numeric ID" />
          <p className="mt-1 text-xs text-[#6b7280]">
            Only used for Facebook Marketplace URL filtering. Leave blank if you do not have the numeric model ID.
          </p>
        </div>
      </div>

      <div>
        <label className={labelCls}>Model Text</label>
        <input
          className={inputCls}
          value={form.modelText}
          onChange={e => set('modelText', e.target.value)}
          placeholder="camry, cx-5, silverado 1500"
        />
        <p className="mt-1 text-xs text-[#6b7280]">
          Used for dealership/title matching, for example: camry, cx-5, silverado 1500.
        </p>
      </div>

      {/* Year / Price / Mileage */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Min Year</label>
          <input className={inputCls} type="number" value={form.minYear} onChange={e => set('minYear', e.target.value)} placeholder="2016" min="1900" max="2030" />
        </div>
        <div>
          <label className={labelCls}>Max Price ($)</label>
          <input className={inputCls} type="number" value={form.maxPrice} onChange={e => set('maxPrice', e.target.value)} placeholder="18000" min="0" />
        </div>
        <div>
          <label className={labelCls}>Max Mileage</label>
          <input className={inputCls} type="number" value={form.maxMileage} onChange={e => set('maxMileage', e.target.value)} placeholder="120000" min="0" />
        </div>
      </div>

      {/* Location + Radius */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Location (city slug) *</label>
          <input className={inputCls} value={form.location} onChange={e => set('location', e.target.value)} required placeholder="tampa" />
        </div>
        <div>
          <label className={labelCls}>Radius (mi)</label>
          <input className={inputCls} type="number" value={form.radiusMiles} onChange={e => set('radiusMiles', e.target.value)} min="1" max="500" />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-2">
        {([
          ['includePrivate', 'Include private sellers'],
          ['includeDealers', 'Include dealers'],
          ['japaneseOnly',   'Japanese brands only (Toyota, Honda, Mazda, Nissan, Lexus, Infiniti, Acura)'],
          ['isActive',       'Active (scraper will monitor this profile)'],
        ] as [keyof FormState, string][]).map(([field, label]) => (
          <label key={field} className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={form[field] as boolean}
              onChange={e => set(field, e.target.checked)}
              className="mt-0.5 accent-[#10b981]"
            />
            <span className="text-sm text-[#f0f0f0] group-hover:text-white">{label}</span>
          </label>
        ))}
      </div>

      {/* Quiet hours */}
      <div className="space-y-2">
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.quietEnabled}
            onChange={e => set('quietEnabled', e.target.checked)}
            className="mt-0.5 accent-[#10b981]"
          />
          <span className="text-sm text-[#f0f0f0] group-hover:text-white">Quiet hours (pause scraping during set window)</span>
        </label>
        {form.quietEnabled && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div>
              <label className={labelCls}>From (hour)</label>
              <select className={inputCls} value={form.quietFrom} onChange={e => set('quietFrom', e.target.value)}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={String(h)}>{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Until (hour)</label>
              <select className={inputCls} value={form.quietUntil} onChange={e => set('quietUntil', e.target.value)}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={String(h)}>{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-[#ef4444]">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-white text-sm font-medium rounded-sm transition-colors"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#f0f0f0] text-sm rounded-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<SearchProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<SearchProfile | null>(null)  // null = closed, undefined = new
  const [creating, setCreating] = useState(false)

  async function load() {
    const res = await fetch('/api/search-profiles')
    const data = await res.json()
    setProfiles(data.profiles ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(form: FormState) {
    const res = await fetch('/api/search-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formToPayload(form)),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Create failed')
    }
    setCreating(false)
    await load()
  }

  async function handleUpdate(form: FormState) {
    if (!editing) return
    const res = await fetch(`/api/search-profiles/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formToPayload(form)),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Update failed')
    }
    setEditing(null)
    await load()
  }

  async function handleToggleActive(p: SearchProfile) {
    await fetch(`/api/search-profiles/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    await load()
  }

  async function handleDelete(p: SearchProfile) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    await fetch(`/api/search-profiles/${p.id}`, { method: 'DELETE' })
    await load()
  }

  const formOpen = creating || editing !== null

  return (
    <div className="flex h-full">
      {/* ── Profile list ──────────────────────────────────────────────── */}
      <div className={`flex-1 border-r border-[#2a2a2a] overflow-auto ${formOpen ? 'hidden lg:block' : ''}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h1 className="text-lg font-semibold text-[#f0f0f0]">Search Profiles</h1>
          <button
            onClick={() => { setEditing(null); setCreating(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-sm font-medium rounded-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            New profile
          </button>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-sm text-[#6b7280]">Loading…</p>
        ) : profiles.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-[#6b7280]">No search profiles.</p>
            <p className="text-sm text-[#6b7280]">Add one to start monitoring.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#2a2a2a]">
            {profiles.map(p => (
              <li key={p.id} className="flex items-start justify-between px-6 py-4 hover:bg-[#161616] group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.isActive ? 'bg-[#10b981]' : 'bg-[#6b7280]'}`} />
                    <span className="text-sm font-medium text-[#f0f0f0] truncate">{p.name}</span>
                  </div>
                  <ProfileSummary p={p} />
                </div>

                <div className="flex items-center gap-1 ml-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggleActive(p)}
                    title={p.isActive ? 'Deactivate' : 'Activate'}
                    className="px-2 py-1 text-xs text-[#6b7280] hover:text-[#f0f0f0] bg-[#1f1f1f] rounded-sm transition-colors"
                  >
                    {p.isActive ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => { setCreating(false); setEditing(p) }}
                    className="p-1.5 text-[#6b7280] hover:text-[#f0f0f0] hover:bg-[#1f1f1f] rounded-sm transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="p-1.5 text-[#6b7280] hover:text-[#ef4444] hover:bg-[#1f1f1f] rounded-sm transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Form panel ────────────────────────────────────────────────── */}
      {formOpen && (
        <div className="w-full lg:w-[420px] shrink-0 overflow-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
            <h2 className="text-sm font-semibold text-[#f0f0f0]">
              {creating ? 'New Profile' : `Edit — ${editing?.name}`}
            </h2>
            <button
              onClick={() => { setCreating(false); setEditing(null) }}
              className="text-[#6b7280] hover:text-[#f0f0f0]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-6 py-5">
            <ProfileForm
              initial={editing ? profileToForm(editing) : DEFAULT_FORM}
              onSave={creating ? handleCreate : handleUpdate}
              onCancel={() => { setCreating(false); setEditing(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formToPayload(form: FormState) {
  return {
    name:           form.name,
    make:           form.make   || undefined,
    model:          form.model  || undefined,
    modelText:      form.modelText || undefined,
    minYear:        form.minYear    ? parseInt(form.minYear, 10)    : undefined,
    maxPrice:       form.maxPrice   ? parseInt(form.maxPrice, 10)   : undefined,
    maxMileage:     form.maxMileage ? parseInt(form.maxMileage, 10) : undefined,
    location:       form.location,
    radiusMiles:    parseInt(form.radiusMiles, 10) || 50,
    includePrivate: form.includePrivate,
    includeDealers: form.includeDealers,
    japaneseOnly:   form.japaneseOnly,
    isActive:       form.isActive,
    quietFrom:      form.quietEnabled ? parseInt(form.quietFrom, 10) : null,
    quietUntil:     form.quietEnabled ? parseInt(form.quietUntil, 10) : null,
  }
}
