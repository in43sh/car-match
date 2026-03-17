/**
 * Scraper orchestrator — runs one full scrape cycle.
 *
 * Called by the cron job (src/jobs/scrape.ts) on each scheduled tick.
 * For each active search profile:
 *   1. Build the FB Marketplace search URL
 *   2. Scrape listing cards from the page
 *   3. Skip listings already in the DB (deduplication via fb_listing_id)
 *   4. Insert new listings with status = 'new'
 *   5. Call onNewListing callback (Telegram alert) for each insert
 *
 * Session check is done once before the cycle starts. If the session is
 * invalid the cycle is skipped and the error is logged — the worker will
 * retry on the next scheduled tick.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { listings, searchProfiles } from '@/db/schema'
import type { Listing, SearchProfile } from '@/db/schema'
import { getBrowserContext, saveSessionCookies } from './browser'
import { isSessionValid } from './session'
import { scrapeListings } from './marketplace'
import { scrapeGaaInventory } from './gaa'
import { scrapeCraigslist } from './craigslist'
import { matchesProfile, type ScrapedListing } from './shared'
import { writeStatusFile } from '@/lib/status'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScrapeResult {
  profilesRun: number
  inserted:    number
  skipped:     number
  errors:      number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs)
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isInQuietWindow(quietFrom: number | null, quietUntil: number | null): boolean {
  if (quietFrom === null || quietUntil === null) return false
  const hour = new Date().getHours()
  if (quietFrom <= quietUntil) {
    return hour >= quietFrom && hour < quietUntil
  } else {
    // Overnight wrap: e.g. from=22, until=6 covers 22,23,0,1,2,3,4,5
    return hour >= quietFrom || hour < quietUntil
  }
}

function getActiveProfiles(): SearchProfile[] {
  return db
    .select()
    .from(searchProfiles)
    .where(eq(searchProfiles.isActive, true))
    .all()
    .filter(p => {
      if (isInQuietWindow(p.quietFrom ?? null, p.quietUntil ?? null)) {
        console.log(`[scraper] Profile "${p.name}" — quiet window active, skipping`)
        return false
      }
      return true
    })
}

async function persistListing(
  profile: SearchProfile,
  s: ScrapedListing,
  result: ScrapeResult,
  onNewListing?: (listing: Listing) => Promise<void>,
): Promise<void> {
  const existing = db
    .select({ id: listings.id, matchedProfileIds: listings.matchedProfileIds })
    .from(listings)
    .where(eq(listings.fbListingId, s.fbListingId))
    .get()

  if (existing) {
    result.skipped++
    const ids: number[] = JSON.parse(existing.matchedProfileIds ?? '[]')
    if (!ids.includes(profile.id)) {
      ids.push(profile.id)
      db.update(listings)
        .set({ matchedProfileIds: JSON.stringify(ids) })
        .where(eq(listings.id, existing.id))
        .run()
    }
    return
  }

  const now = new Date().toISOString()
  const [inserted] = db.insert(listings).values({
    fbListingId:       s.fbListingId,
    profileId:         profile.id,
    title:             s.title,
    price:             s.price ?? null,
    mileage:           s.mileage ?? null,
    year:              s.year ?? null,
    location:          s.location ?? null,
    fbUrl:             s.fbUrl,
    imageUrl:          s.imageUrl ?? null,
    sellerType:        s.sellerType ?? null,
    status:            'new',
    matchedProfileIds: JSON.stringify([profile.id]),
    createdAt:         now,
    updatedAt:         now,
  }).returning().all()

  result.inserted++
  console.log(`[scraper] New listing: "${inserted.title}" ($${inserted.price ?? '?'})`)

  if (!onNewListing) return

  try {
    await onNewListing(inserted)
    db.update(listings)
      .set({ alertedAt: new Date().toISOString() })
      .where(eq(listings.id, inserted.id))
      .run()
  } catch (alertErr) {
    console.error('[scraper] Alert failed for listing', inserted.id, alertErr)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// Track whether we've already alerted about the current session-invalid episode
// so we don't spam on every cron tick.
let sessionAlertSent = false

export async function runScrapeCycle(
  onNewListing?: (listing: Listing) => Promise<void>,
  onError?: (message: string) => Promise<void>,
): Promise<ScrapeResult> {
  const result: ScrapeResult = { profilesRun: 0, inserted: 0, skipped: 0, errors: 0 }
  const activeProfiles = getActiveProfiles()

  if (activeProfiles.length === 0) {
    console.log('[scraper] No active profiles — nothing to scrape')
    await writeStatusFile('idle', 0)
    return result
  }

  const context = await getBrowserContext()

  // ── Dealer scrape ──────────────────────────────────────────────────────────
  const dealerPage = await context.newPage()
  try {
    console.log('[scraper] GAA Auto Sales — scraping inventory')
    const dealerListings = await scrapeGaaInventory(dealerPage)
    console.log(`[scraper] GAA Auto Sales — scraped ${dealerListings.length} listing(s)`)

    for (const profile of activeProfiles) {
      const matchedDealerListings = dealerListings.filter(listing => matchesProfile(listing, profile))
      for (const listing of matchedDealerListings) {
        await persistListing(profile, listing, result, onNewListing)
      }
    }
  } catch (err) {
    console.error('[scraper] Error scraping GAA Auto Sales:', err)
    result.errors++
    if (onError) {
      await onError(
        `⚠️ <b>Scraper error</b> — source "<i>GAA Auto Sales</i>"\n\n` +
        `<code>${String(err).slice(0, 400)}</code>`,
      ).catch(() => {})
    }
  } finally {
    await dealerPage.close()
  }

  // ── FB session check ───────────────────────────────────────────────────────
  const fbSessionValid = await isSessionValid(context)

  if (!fbSessionValid) {
    console.error('[scraper] FB session invalid — run `npm run fb:login` to re-authenticate')
    if (!sessionAlertSent && onError) {
      sessionAlertSent = true
      await onError(
        '⚠️ <b>FB session expired</b>\n\n' +
        'The scraper has stopped. Run <code>npm run fb:login</code> on your Mac, ' +
        'then copy <code>data/fb-session.json</code> to the server and restart the worker.',
      ).catch(() => {})
    }
  } else {
    sessionAlertSent = false
  }

  // ── Scrape each profile ────────────────────────────────────────────────────
  if (fbSessionValid) {
    console.log(`[scraper] Facebook Marketplace — starting cycle for ${activeProfiles.length} active profile(s)`)

    for (const profile of activeProfiles) {
      const page = await context.newPage()

      try {
        console.log(`[scraper] FB profile "${profile.name}" — ${profile.location}`)

        const scraped = await scrapeListings(page, profile)
        console.log(`[scraper] Scraped ${scraped.length} matching FB listing(s)`)

        for (const s of scraped) {
          await persistListing(profile, s, result, onNewListing)
        }

        result.profilesRun++
      } catch (err) {
        console.error(`[scraper] Error scraping profile "${profile.name}":`, err)
        result.errors++
        if (onError) {
          await onError(
            `⚠️ <b>Scraper error</b> — profile "<i>${profile.name}</i>"\n\n` +
            `<code>${String(err).slice(0, 400)}</code>`,
          ).catch(() => {})
        }
      } finally {
        await page.close()
      }

      if (activeProfiles.indexOf(profile) < activeProfiles.length - 1) {
        await randomDelay(5_000, 10_000)
      }
    }
  }

  // ── Craigslist scrape ──────────────────────────────────────────────────────
  console.log(`[scraper] Craigslist — starting cycle for ${activeProfiles.length} active profile(s)`)

  for (const profile of activeProfiles) {
    try {
      const scraped = await scrapeCraigslist(profile)
      console.log(`[scraper] CL profile "${profile.name}" — ${scraped.length} listing(s)`)

      for (const s of scraped) {
        await persistListing(profile, s, result, onNewListing)
      }
    } catch (err) {
      console.error(`[scraper] Error scraping CL profile "${profile.name}":`, err)
      result.errors++
      if (onError) {
        await onError(
          `⚠️ <b>Scraper error</b> — CL profile "<i>${profile.name}</i>"\n\n` +
          `<code>${String(err).slice(0, 400)}</code>`,
        ).catch(() => {})
      }
    }

    if (activeProfiles.indexOf(profile) < activeProfiles.length - 1) {
      await randomDelay(2_000, 5_000)
    }
  }

  // ── Persist refreshed session cookies ─────────────────────────────────────
  await saveSessionCookies()

  // ── Write heartbeat ────────────────────────────────────────────────────────
  await writeStatusFile('active', activeProfiles.length)

  console.log(`[scraper] Cycle complete — inserted: ${result.inserted}, skipped: ${result.skipped}, errors: ${result.errors}`)
  return result
}
