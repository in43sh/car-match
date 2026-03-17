/**
 * Craigslist "cars & trucks — all" scraper.
 *
 * Uses the Craigslist RSS feed — no browser or session required.
 * Called once per active search profile by the scraper orchestrator.
 *
 * Mileage is not available in the RSS feed and will always be null.
 * Seller type is not available in the RSS feed and will always be null.
 */

import { load } from 'cheerio'
import type { SearchProfile } from '@/db/schema'
import { extractYear, parsePrice, type ScrapedListing } from './shared'

// ─── Location map ─────────────────────────────────────────────────────────────

/**
 * Maps profile.location values (case-insensitive) to Craigslist subdomains.
 * Add entries here as new search profiles are created for new cities.
 */
const SUBDOMAIN_MAP: Record<string, string> = {
  'tampa':             'tampa',
  'st. petersburg':    'tampa',
  'clearwater':        'tampa',
  'orlando':           'orlando',
  'miami':             'miami',
  'jacksonville':      'jacksonville',
  'fort lauderdale':   'fortlauderdale',
  'west palm beach':   'westpalmbeach',
  'sarasota':          'sarasota',
  'gainesville':       'gainesville',
  'tallahassee':       'tallahassee',
  'ocala':             'ocala',
  'pensacola':         'pensacola',
  'daytona beach':     'daytona',
  'cape coral':        'swfl',
  'fort myers':        'swfl',
  'naples':            'swfl',
}

function getSubdomain(location: string): string | null {
  return SUBDOMAIN_MAP[location.toLowerCase()] ?? null
}

// ─── URL builder ──────────────────────────────────────────────────────────────

export function buildRssUrl(profile: SearchProfile): string | null {
  const subdomain = getSubdomain(profile.location)
  if (!subdomain) return null

  const params = new URLSearchParams({ format: 'rss' })

  const queryParts = [profile.make, profile.modelText].filter(Boolean)
  if (queryParts.length > 0) params.set('query', queryParts.join(' '))

  if (profile.maxPrice   != null) params.set('max_price',       String(profile.maxPrice))
  if (profile.maxMileage != null) params.set('max_auto_miles',  String(profile.maxMileage))
  if (profile.minYear    != null) params.set('min_auto_year',   String(profile.minYear))
  if (profile.radiusMiles > 0)   params.set('search_distance', String(profile.radiusMiles))

  return `https://${subdomain}.craigslist.org/search/cta?${params}`
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/** Extract the Craigslist 10-digit listing ID from a URL. */
function extractListingId(url: string): string | null {
  const match = url.match(/\/(\d{10})\.html/)
  return match ? `cl_${match[1]}` : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRssItem($item: any): ScrapedListing | null {
  const rawTitle = $item.find('title').first().text().trim()

  // <link> text can be unreliable in xmlMode; fall back to <guid>
  const link =
    $item.find('link').first().text().trim() ||
    $item.find('guid').first().text().trim()

  if (!rawTitle || !link) return null

  const id = extractListingId(link)
  if (!id) return null

  // Title format: "YEAR MAKE MODEL - $PRICE (City, ST)"
  const priceMatch = rawTitle.match(/\$[\d,]+/)
  const price      = priceMatch ? parsePrice(priceMatch[0]) : null

  // Strip "- $PRICE (location)" suffix for a clean title
  const cleanTitle = rawTitle
    .replace(/\s*[-–]\s*\$[\d,]+.*$/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()

  const title = cleanTitle || rawTitle
  const year  = extractYear(title)

  const locationMatch = rawTitle.match(/\(([^)]+)\)\s*$/)
  const location      = locationMatch ? locationMatch[1] : null

  // Craigslist attaches the first photo as an <enclosure> element
  const imageUrl = $item.find('enclosure').attr('url') ?? null

  return {
    fbListingId: id,
    title,
    price,
    mileage:    null, // not available in RSS
    year,
    location,
    fbUrl:      link,
    imageUrl,
    sellerType: null, // not available in RSS
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Scrapes Craigslist cars & trucks for the given profile via RSS.
 * No browser or session required. Returns raw listings; deduplication
 * and profile matching are handled by the caller (src/scraper/index.ts).
 */
export async function scrapeCraigslist(profile: SearchProfile): Promise<ScrapedListing[]> {
  const url = buildRssUrl(profile)
  if (!url) {
    console.log(`[craigslist] No subdomain mapped for location "${profile.location}" — skipping`)
    return []
  }

  console.log(`[craigslist] Fetching ${url}`)

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    throw new Error(`Craigslist RSS request failed: HTTP ${res.status}`)
  }

  const xml = await res.text()
  const $   = load(xml, { xmlMode: true })

  const results: ScrapedListing[] = []
  $('item').each((_, el) => {
    const listing = parseRssItem($(el))
    if (listing) results.push(listing)
  })

  return results
}
