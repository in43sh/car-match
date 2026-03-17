# Scrapers

Overview of all data sources CarMatch scrapes, plus a guide for adding new ones.

---

## Current scrapers

### 1. Facebook Marketplace (`src/scraper/marketplace.ts`)

Scrapes FB Marketplace vehicle search results for each active search profile.

| Property | Value |
|---|---|
| Source | `facebook.com/marketplace/{location}/vehicles/` |
| Auth required | Yes — Playwright browser context with FB session cookies |
| Pagination | No — single page of results per profile |
| Deduplication key | `fbListingId` (numeric listing ID from URL) |
| Seller type | Not available in card DOM (`null`) |

**How it works:**
1. Builds a search URL from the profile's make, model, maxPrice, maxMileage, minYear, and location
2. Navigates with Playwright and waits for listing cards (`a[href*="/marketplace/item/"]`)
3. Extracts title, price, mileage, year, location from each card's DOM
4. Post-filters results against the profile (duplicate URL filter, year/price/mileage bounds)
5. Returns `ScrapedListing[]` — deduplication against the DB happens in `src/scraper/index.ts`

**Session:** Requires a valid `data/fb-session.json`. See [scraper.md](scraper.md) for session refresh steps and selector maintenance.

---

### 2. GAA Auto Sales (`src/scraper/gaa.ts`)

Scrapes the full vehicle inventory from a specific local dealership.

| Property | Value |
|---|---|
| Source | `gaaautosales.com/inventory/` |
| Auth required | No |
| Pagination | Yes — iterates all pages via `?page_no=N` |
| Deduplication key | Full listing URL (used as `fbListingId`) |
| Seller type | Always `"dealer"` |

**How it works:**
1. Navigates to the inventory page and detects the last pagination page number
2. Iterates each page, extracting `.dws-listing-item` cards (title, price, mileage, image)
3. Collects results in a `Map` keyed by URL (deduplicates within the run)
4. Returns `ScrapedListing[]` — profile matching happens in `src/scraper/index.ts` via `matchesProfile()`

---

## Scrape cycle order (`src/scraper/index.ts`)

Each cron tick runs:
1. **GAA Auto Sales** — no auth, runs unconditionally
2. **FB session check** — verifies `c_user` cookie is present
3. **Facebook Marketplace** — runs once per active profile (with 5–10s random delays between profiles), skipped if session is invalid

---

## Adding a new scraper

### 1. Create the scraper file

Add `src/scraper/<source-name>.ts`. At minimum it should export one async function:

```ts
import type { Page } from 'playwright'
import type { ScrapedListing } from './shared'

export async function scrape<SourceName>(page: Page): Promise<ScrapedListing[]> {
  // 1. Navigate to the source URL
  // 2. Wait for listing elements to appear
  // 3. Extract raw data from the DOM
  // 4. Map to ScrapedListing[] using helpers from ./shared
  return listings
}
```

Use the helpers in `src/scraper/shared.ts`:
- `parsePrice(text)` — strips non-numeric chars, returns `number | null`
- `parseMileage(text)` — handles `"95K miles"`, `"67,000 miles"`, etc.
- `extractYear(title)` — regex on title prefix, returns `number | null`
- `matchesProfile(listing, profile)` — checks all profile filters (price, mileage, year, make, model, seller type)

### 2. Wire it into the orchestrator

In `src/scraper/index.ts`, add a block alongside the existing GAA scrape:

```ts
// ── <Source name> scrape ────────────────────────────────────────────────────
const sourcePage = await context.newPage()
try {
  const sourceListings = await scrapeSourceName(sourcePage)
  for (const profile of activeProfiles) {
    const matched = sourceListings.filter(l => matchesProfile(l, profile))
    for (const listing of matched) {
      await persistListing(profile, listing, result, onNewListing)
    }
  }
} catch (err) {
  console.error('[scraper] Error scraping <source>:', err)
  result.errors++
  if (onError) {
    await onError(
      `⚠️ <b>Scraper error</b> — source "<i><source name></i>"\n\n` +
      `<code>${String(err).slice(0, 400)}</code>`,
    ).catch(() => {})
  }
} finally {
  await sourcePage.close()
}
```

### 3. Deduplication

The `fbListingId` column in the `listings` table is the dedup key. For non-FB sources, use the listing's full URL (like GAA does). This ensures the same vehicle from two different sources isn't inserted twice — the second insert is skipped and the profile ID is appended to `matchedProfileIds` instead.

### 4. Profile matching

`matchesProfile()` in `src/scraper/shared.ts` handles all filter logic (price, mileage, year, make, model, seller type, `japaneseOnly`). If the new source has a known seller type (`"dealer"` or `"private"`), set it on the `ScrapedListing` so `includeDealers` / `includePrivate` profile flags work correctly.

### 5. Document it

Add an entry to this file under **Current scrapers** with source URL, auth requirements, pagination approach, and dedup key.
