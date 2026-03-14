/**
 * Facebook Marketplace scraper — listing extraction.
 *
 * Selector strategy: pattern-based only. Never use class names (obfuscated, change without notice).
 * Primary extraction source: img[alt] = "{title} in {location}" — most stable FB field.
 *
 * See docs/scraper.md for the full selector map and maintenance guide.
 */

import type { Page } from 'playwright'
import type { SearchProfile } from '@/db/schema'
import { getMakeId, isJapaneseBrand } from './brands'
import { extractYear, parseMileage, parsePrice, type ScrapedListing } from './shared'

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── URL Builder ──────────────────────────────────────────────────────────────

export function buildSearchUrl(profile: SearchProfile): string {
  const params = new URLSearchParams()

  if (profile.make) {
    const makeId = getMakeId(profile.make)
    if (makeId) params.set('make', makeId)
  }

  if (profile.model) {
    params.set('model', profile.model)
  }

  if (profile.maxMileage != null) {
    params.set('maxMileage', String(profile.maxMileage))
  }

  if (profile.maxPrice != null) {
    params.set('maxPrice', String(profile.maxPrice))
  }

  // minYear: use URL param if FB supports it (OQ-16 — always set it, also post-filter)
  if (profile.minYear != null) {
    params.set('minYear', String(profile.minYear))
  }

  params.set('exact', 'false')

  // NOTE: radius_miles is stored in search_profiles but CANNOT be applied here.
  // FB Marketplace stores radius preference server-side (tied to the account/session).
  // No radius URL parameter exists — confirmed by setting radius=1mi and inspecting URL.

  return `https://www.facebook.com/marketplace/${profile.location}/vehicles/?${params}`
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/** Strip FB tracking query params from the href. */
function cleanHref(href: string): string {
  // href is relative: /marketplace/item/12345/?ref=...
  return href.split('?')[0]
}

// ─── Card Extractor ───────────────────────────────────────────────────────────

interface RawCard {
  href: string
  altText: string | null
  imageSrc: string | null
  textNodes: string[]
}

async function extractRawCards(page: Page): Promise<RawCard[]> {
  return page.$$eval('a[href*="/marketplace/item/"]', anchors =>
    anchors.map(anchor => {
      const img = anchor.querySelector('img')
      const spans = Array.from(anchor.querySelectorAll('span[dir="auto"]'))
        .map(s => (s as HTMLElement).innerText?.trim())
        .filter((t): t is string => Boolean(t) && t.length > 0 && t.length < 120)

      return {
        href: anchor.getAttribute('href') ?? '',
        altText: img?.getAttribute('alt') ?? null,
        imageSrc: img?.getAttribute('src') ?? null,
        textNodes: spans,
      }
    })
  )
}

function parseCard(raw: RawCard): ScrapedListing | null {
  // Listing ID from href
  const idMatch = raw.href.match(/\/item\/(\d+)/)
  if (!idMatch) return null
  const fbListingId = idMatch[1]

  const fbUrl = 'https://www.facebook.com' + cleanHref(raw.href)

  // Title and location: prefer img[alt] as it's the most stable source
  let title: string | null = null
  let location: string | null = null

  if (raw.altText) {
    // Format: "{title} in {city}, {state}" — split on last occurrence of " in "
    const inIdx = raw.altText.lastIndexOf(' in ')
    if (inIdx !== -1) {
      title = raw.altText.slice(0, inIdx).trim()
      location = raw.altText.slice(inIdx + 4).trim()
    } else {
      title = raw.altText.trim()
    }
  }

  // Fallback: title from text nodes — span with line-clamp is the title span
  // (text node [1] in observed structure — after price)
  if (!title && raw.textNodes.length >= 2) {
    title = raw.textNodes[1] ?? null
  }

  if (!title) return null

  const year = extractYear(title)

  // Price: first text node matching $XX,XXX
  const priceText = raw.textNodes.find(t => /^\$[0-9,]+$/.test(t))
  const price = priceText ? parsePrice(priceText) : null

  // Mileage: text node matching mileage pattern
  const mileageText = raw.textNodes.find(t => /[0-9].*miles?/i.test(t))
  const mileage = mileageText ? parseMileage(mileageText) : null

  return {
    fbListingId,
    title,
    price,
    mileage,
    year,
    location,
    fbUrl,
    imageUrl: raw.imageSrc,
    sellerType: null, // not available in card DOM
  }
}

// ─── Post-Filter ──────────────────────────────────────────────────────────────

function matchesProfile(listing: ScrapedListing, profile: SearchProfile): boolean {
  if (profile.maxPrice != null && listing.price != null && listing.price > profile.maxPrice) {
    return false
  }
  if (profile.maxMileage != null && listing.mileage != null && listing.mileage > profile.maxMileage) {
    return false
  }
  if (profile.minYear != null && listing.year != null && listing.year < profile.minYear) {
    return false
  }
  if (profile.japaneseOnly && listing.title && !isJapaneseBrand(listing.title)) {
    return false
  }
  return true
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Scrapes FB Marketplace search results for the given profile.
 * Returns listings that pass the post-filter. Deduplication against the DB
 * is handled by the caller (scraper/index.ts).
 *
 * @param page - A Playwright Page with an active, logged-in FB session
 * @param profile - The search profile to scrape
 */
export async function scrapeListings(
  page: Page,
  profile: SearchProfile,
): Promise<ScrapedListing[]> {
  const url = buildSearchUrl(profile)

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Wait for listing cards to appear
  try {
    await page.waitForSelector('a[href*="/marketplace/item/"]', { timeout: 15_000 })
  } catch {
    // No results or page failed to load listings — return empty
    return []
  }

  // Brief settle for lazy-loaded images and text
  await page.waitForTimeout(1_500 + Math.random() * 1_000)

  const rawCards = await extractRawCards(page)

  const listings: ScrapedListing[] = []
  for (const raw of rawCards) {
    const listing = parseCard(raw)
    if (!listing) continue
    if (!matchesProfile(listing, profile)) continue
    listings.push(listing)
  }

  return listings
}
