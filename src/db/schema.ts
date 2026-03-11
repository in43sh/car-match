import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── search_profiles ──────────────────────────────────────────────────────────
//
// One row per saved search. The scraper loads all active profiles every cycle
// and builds an FB Marketplace URL per profile.

export const searchProfiles = sqliteTable('search_profiles', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  name:           text('name').notNull(),
  /** Lowercase brand key: "toyota", "honda", etc. Resolved to FB numeric ID at scrape time. */
  make:           text('make'),
  /** FB numeric model ID, e.g. "582109948940125". Omit URL param if null. */
  model:          text('model'),
  /** Year floor — applied both as URL param (minYear) and as post-filter. */
  minYear:        integer('min_year'),
  maxPrice:       integer('max_price'),
  maxMileage:     integer('max_mileage'),
  /** City slug for FB Marketplace URL path, e.g. "tampa". */
  location:       text('location').notNull(),
  /** Stored in profile but NOT applied to the search URL — FB stores radius server-side. */
  radiusMiles:    integer('radius_miles').notNull().default(50),
  includePrivate: integer('include_private', { mode: 'boolean' }).notNull().default(true),
  includeDealers: integer('include_dealers', { mode: 'boolean' }).notNull().default(true),
  /** If true, post-filter results to Toyota/Honda/Mazda/Nissan/Lexus/Infiniti/Acura only. */
  japaneseOnly:   integer('japanese_only', { mode: 'boolean' }).notNull().default(true),
  isActive:       integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:      text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:      text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ─── listings ─────────────────────────────────────────────────────────────────
//
// One row per FB Marketplace listing discovered by the scraper.
// fb_listing_id is the deduplication key — insertion is skipped if it already exists.

export const listings = sqliteTable(
  'listings',
  {
    id:          integer('id').primaryKey({ autoIncrement: true }),
    /** FB's own numeric listing ID — extracted from URL path via regex. */
    fbListingId: text('fb_listing_id').notNull(),
    /** Null when the originating profile was deleted. */
    profileId:   integer('profile_id').references(() => searchProfiles.id, { onDelete: 'set null' }),
    title:       text('title').notNull(),
    price:       integer('price'),
    mileage:     integer('mileage'),
    year:        integer('year'),
    location:    text('location'),
    fbUrl:       text('fb_url').notNull(),
    imageUrl:    text('image_url'),
    sellerType:  text('seller_type', { enum: ['private', 'dealer'] }),
    /** Workflow status — drives dashboard tabs and Telegram alert suppression. */
    status:      text('status', { enum: ['new', 'interested', 'rejected', 'contacted'] })
                   .notNull()
                   .default('new'),
    /** Set after Telegram alert is confirmed sent. Null = alert not yet sent (or send failed). */
    alertedAt:   text('alerted_at'),
    createdAt:   text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt:   text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    fbListingIdIdx: uniqueIndex('listings_fb_listing_id_idx').on(t.fbListingId),
    statusIdx:      index('listings_status_idx').on(t.status),
  }),
)

// ─── carfax_reports ───────────────────────────────────────────────────────────
//
// One row per Carfax report parsed. Can be linked to a listing (listing_id) or
// submitted standalone (listing_id null — report stored without a linked listing).

export const carfaxReports = sqliteTable('carfax_reports', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  /** Nullable: report may be submitted without a linked listing. */
  listingId:       integer('listing_id').references(() => listings.id, { onDelete: 'set null' }),
  carfaxUrl:       text('carfax_url').notNull(),
  accidentCount:   integer('accident_count'),
  ownerCount:      integer('owner_count'),
  /** JSON-encoded string array, e.g. '["Salvage title"]'. Null if parse failed. */
  titleIssues:     text('title_issues'),
  odometerRollback: integer('odometer_rollback', { mode: 'boolean' }),
  /** Last odometer reading CARFAX has on record, in miles. */
  lastOdometer:    integer('last_odometer'),
  /** Full extracted page text, stored for debugging and re-parse. */
  rawSummary:      text('raw_summary'),
  verdict:         text('verdict', { enum: ['pass', 'caution', 'fail', 'unknown'] })
                     .notNull()
                     .default('unknown'),
  /** JSON-encoded string array of reasons explaining a non-pass verdict. */
  verdictReasons:  text('verdict_reasons'),
  parsedAt:        text('parsed_at'),
  createdAt:       text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ─── Inferred types ───────────────────────────────────────────────────────────

export type SearchProfile   = typeof searchProfiles.$inferSelect
export type NewSearchProfile = typeof searchProfiles.$inferInsert

export type Listing    = typeof listings.$inferSelect
export type NewListing = typeof listings.$inferInsert

export type CarfaxReport    = typeof carfaxReports.$inferSelect
export type NewCarfaxReport = typeof carfaxReports.$inferInsert
