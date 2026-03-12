/**
 * Shared TypeScript types for CarMatch.
 *
 * DB row types come directly from Drizzle inference in src/db/schema.ts.
 * This file adds API request/response shapes and shared enums.
 */

// ─── Re-export DB row types ───────────────────────────────────────────────────

export type {
  SearchProfile,
  NewSearchProfile,
  Listing,
  NewListing,
  CarfaxReport,
  NewCarfaxReport,
} from '@/db/schema'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ListingStatus = 'new' | 'interested' | 'rejected' | 'contacted'

export type Verdict = 'pass' | 'caution' | 'fail' | 'unknown'

export type SellerType = 'private' | 'dealer'

export type ScraperStatus = 'active' | 'error' | 'idle'

// ─── API: Listings ────────────────────────────────────────────────────────────

export interface ListingsQuery {
  status?: ListingStatus
  profile_id?: number
  q?: string
  page?: number
  limit?: number
}

export interface ListingsResponse {
  listings: import('@/db/schema').Listing[]
  total: number
  page: number
  pages: number
}

export interface ListingDetailResponse {
  listing: import('@/db/schema').Listing
  carfaxReport: import('@/db/schema').CarfaxReport | null
}

export interface PatchListingStatusBody {
  status: ListingStatus
}

// ─── API: Search Profiles ─────────────────────────────────────────────────────

export interface ProfilesResponse {
  profiles: import('@/db/schema').SearchProfile[]
}

export interface CreateProfileBody {
  name: string
  make?: string
  model?: string
  minYear?: number
  maxPrice?: number
  maxMileage?: number
  location: string
  radiusMiles?: number
  includePrivate?: boolean
  includeDealers?: boolean
  japaneseOnly?: boolean
}

export type UpdateProfileBody = Partial<CreateProfileBody & { isActive: boolean }>

// ─── API: Carfax ──────────────────────────────────────────────────────────────

export interface CreateCarfaxBody {
  url: string
  listingId?: number
}

export interface CarfaxListQuery {
  verdict?: Verdict
  listing_id?: number
  page?: number
  limit?: number
}

export interface CarfaxListResponse {
  reports: import('@/db/schema').CarfaxReport[]
  total: number
  page: number
  pages: number
}

export interface CarfaxDetailResponse {
  report: import('@/db/schema').CarfaxReport
  listing: import('@/db/schema').Listing | null
}

// ─── API: Status ──────────────────────────────────────────────────────────────

export interface StatusResponse {
  scraper: ScraperStatus
  lastRunAt: string | null
  nextRunAt: string | null
  activeProfiles: number
  lastError?: string
}

// Shape written to data/status.json by the worker after each scrape cycle
export interface StatusFile {
  status: ScraperStatus
  lastRunAt: string
  nextRunAt: string
  activeProfiles: number
  lastError?: string
}

// ─── Pagination helper ────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pages: number
}
