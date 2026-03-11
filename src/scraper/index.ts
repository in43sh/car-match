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
import type { Listing } from '@/db/schema'
import { getBrowserContext, saveSessionCookies } from './browser'
import { isSessionValid } from './session'
import { scrapeListings } from './marketplace'
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runScrapeCycle(
  onNewListing?: (listing: Listing) => Promise<void>,
): Promise<ScrapeResult> {
  const result: ScrapeResult = { profilesRun: 0, inserted: 0, skipped: 0, errors: 0 }

  // ── Session check ──────────────────────────────────────────────────────────
  const context = await getBrowserContext()

  if (!await isSessionValid(context)) {
    console.error('[scraper] FB session invalid — run `npx tsx scripts/fb-login.ts` to re-authenticate')
    await writeStatusFile('error', 0, 'FB session invalid')
    return result
  }

  // ── Load active profiles ───────────────────────────────────────────────────
  const activeProfiles = db
    .select()
    .from(searchProfiles)
    .where(eq(searchProfiles.isActive, true))
    .all()

  if (activeProfiles.length === 0) {
    console.log('[scraper] No active profiles — nothing to scrape')
    await writeStatusFile('idle', 0)
    return result
  }

  console.log(`[scraper] Starting cycle — ${activeProfiles.length} active profile(s)`)

  // ── Scrape each profile ────────────────────────────────────────────────────
  for (const profile of activeProfiles) {
    const page = await context.newPage()

    try {
      console.log(`[scraper] Profile "${profile.name}" — ${profile.location}`)

      const scraped = await scrapeListings(page, profile)
      console.log(`[scraper] Scraped ${scraped.length} matching listing(s)`)

      for (const s of scraped) {
        // Dedup check
        const existing = db
          .select({ id: listings.id })
          .from(listings)
          .where(eq(listings.fbListingId, s.fbListingId))
          .get()

        if (existing) {
          result.skipped++
          continue
        }

        // Insert
        const now = new Date().toISOString()
        const [inserted] = db.insert(listings).values({
          fbListingId: s.fbListingId,
          profileId:   profile.id,
          title:       s.title,
          price:       s.price ?? null,
          mileage:     s.mileage ?? null,
          year:        s.year ?? null,
          location:    s.location ?? null,
          fbUrl:       s.fbUrl,
          imageUrl:    s.imageUrl ?? null,
          sellerType:  s.sellerType ?? null,
          status:      'new',
          createdAt:   now,
          updatedAt:   now,
        }).returning().all()

        result.inserted++
        console.log(`[scraper] New listing: "${inserted.title}" ($${inserted.price ?? '?'})`)

        // Alert callback (wired in Step 18)
        if (onNewListing) {
          try {
            await onNewListing(inserted)
            // Mark alerted
            db.update(listings)
              .set({ alertedAt: new Date().toISOString() })
              .where(eq(listings.id, inserted.id))
              .run()
          } catch (alertErr) {
            console.error('[scraper] Alert failed for listing', inserted.id, alertErr)
          }
        }
      }

      result.profilesRun++
    } catch (err) {
      console.error(`[scraper] Error scraping profile "${profile.name}":`, err)
      result.errors++
    } finally {
      await page.close()
    }

    // Rate limiting — pause between profiles
    if (activeProfiles.indexOf(profile) < activeProfiles.length - 1) {
      await randomDelay(5_000, 10_000)
    }
  }

  // ── Persist refreshed session cookies ─────────────────────────────────────
  await saveSessionCookies()

  // ── Write heartbeat ────────────────────────────────────────────────────────
  await writeStatusFile('active', activeProfiles.length)

  console.log(`[scraper] Cycle complete — inserted: ${result.inserted}, skipped: ${result.skipped}, errors: ${result.errors}`)
  return result
}
