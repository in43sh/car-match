import { z } from 'zod'

// ─── Search Profiles ──────────────────────────────────────────────────────────

export const createProfileSchema = z.object({
  name:           z.string().min(1).max(100),
  make:           z.string().min(1).max(50).optional(),
  model:          z.string().min(1).max(50).optional(),
  minYear:        z.number().int().min(1900).max(2030).optional(),
  maxPrice:       z.number().int().min(0).max(10_000_000).optional(),
  maxMileage:     z.number().int().min(0).max(1_000_000).optional(),
  location:       z.string().min(1).max(100),
  radiusMiles:    z.number().int().min(1).max(500).default(50),
  includePrivate: z.boolean().default(true),
  includeDealers: z.boolean().default(true),
  japaneseOnly:   z.boolean().default(true),
})

export const updateProfileSchema = createProfileSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })

// ─── Listings ─────────────────────────────────────────────────────────────────

export const listingStatusSchema = z.object({
  status: z.enum(['new', 'interested', 'rejected', 'contacted']),
})

// ─── Carfax ───────────────────────────────────────────────────────────────────

export const createCarfaxSchema = z.object({
  url:       z.string().regex(/^https:\/\/api\.carfax\.shop\/report\/view\?hash=/, {
    message: 'URL must be a valid api.carfax.shop report URL',
  }),
  listingId: z.number().int().positive().optional(),
})
