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

### 3. Craigslist (`src/scraper/craigslist.ts`) — DISABLED

**Status: disabled as of 2026-03-18. The production server IP (DigitalOcean datacenter) is blocked by Craigslist — all RSS requests return HTTP 403. See roadmap below for re-enabling options.**

Scrapes Craigslist "cars & trucks — all" for each active search profile via RSS.

| Property | Value |
|---|---|
| Source | `{city}.craigslist.org/search/cta?format=rss` |
| Auth required | No |
| Pagination | No — first page of RSS results only (~25 listings) |
| Deduplication key | `cl_` + 10-digit Craigslist listing ID from URL |
| Seller type | Not available in RSS (`null`) |
| Mileage | Not available in RSS (`null`) |

**How it works:**
1. Maps `profile.location` to a Craigslist subdomain (see `SUBDOMAIN_MAP` in the file)
2. Builds an RSS URL using `query`, `max_price`, `max_auto_miles`, `min_auto_year`, `search_distance`
3. Fetches the RSS feed with plain `fetch` (via `undici`) — no browser needed
4. Parses `<item>` elements with cheerio in XML mode: extracts title, price, year, location, image from title text and enclosure tag
5. Returns `ScrapedListing[]` — deduplication and profile matching handled in `src/scraper/index.ts`

**Known limitation:** CL RSS has no mileage and no seller type — only title, price, year, location, and image.

**Adding a new city:** Add a `"city name": "subdomain"` entry to `SUBDOMAIN_MAP` in the scraper file. Find the correct subdomain at [craigslist.org](https://www.craigslist.org/about/sites).

**To re-enable with a proxy:** See Option A in the roadmap below.

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

---

## Roadmap

### Option A — Re-enable Craigslist via residential proxy

**Why CL is blocked:** The DigitalOcean server IP is on Craigslist's datacenter blocklist. Browser-like headers don't help — the block is at the IP level (confirmed with plain `curl` from the server returning 403).

**Current state:** CL scraper is disabled (removed from the cycle in `src/scraper/index.ts`) to stop error spam.

**Steps to re-enable:**

1. Sign up for a residential proxy service. Cheapest reliable option: [Webshare.io](https://webshare.io) (~$3-4/mo rotating residential)
2. Get a proxy URL in the format `http://user:pass@host:port`
3. In `src/scraper/craigslist.ts`, switch `fetch` to `undici`'s fetch with a `ProxyAgent`:
   ```ts
   import { ProxyAgent, fetch as undiciFetch } from 'undici'
   // in scrapeCraigslist():
   const dispatcher = new ProxyAgent(process.env.CL_PROXY_URL!)
   const res = await undiciFetch(url, { dispatcher, headers: { ... } })
   ```
4. Add `CL_PROXY_URL=http://user:pass@proxy.webshare.io:80` to `.env` on the server
5. Re-add the CL scrape block to `src/scraper/index.ts` (see git history for the removed block)
6. Deploy and monitor logs — if 403s persist, the proxy IPs are also blocked and you need higher-quality residential proxies

**Limitations even when working:**
- RSS feed only returns ~25 listings per search (no pagination)
- No mileage data in RSS
- No seller type in RSS
- High overlap with FB Marketplace (same private sellers often post both)

---

### Option B — Add AutoTrader / Cars.com scraper

**Why this is better value than fixing CL:**
- Structured, reliable data — full mileage, year, trim, VIN, seller type
- Covers dealer inventory that FB Marketplace largely doesn't
- No session/cookie management needed
- Less aggressive bot blocking than CL

**Recommended approach:** Playwright-based scraper (same pattern as FB Marketplace), scraping once per profile per cycle.

**AutoTrader search URL pattern:**
```
https://www.autotrader.com/cars-for-sale/used-cars/{make}/{model}?zip=33601&maxPrice=15000&maxMileage=100000
```

**Implementation steps:**
1. Create `src/scraper/autotrader.ts` following the pattern in `gaa.ts`
2. Build a URL from `profile.make`, `profile.model`, `profile.maxPrice`, `profile.maxMileage`, `profile.location` (zip code lookup needed — add a zip map similar to CL's `SUBDOMAIN_MAP`)
3. Use `matchesProfile()` for post-filtering
4. Wire into `src/scraper/index.ts` alongside GAA
5. Dedup key: full listing URL

**Note:** AutoTrader uses React rendering — wait for listing cards to appear before extracting, same approach as FB Marketplace.

---

### Option C — Add OfferUp scraper

**Why:** Private sellers who skip FB Marketplace, strong in Florida markets.

**Approach:** Playwright-based. OfferUp has a web search at `offerup.com/search/?q=toyota+camry&location=tampa,fl`.

**Limitation:** Less structured than AutoTrader — title parsing required for year/make/model (same as CL).

---

### Priority recommendation

| Priority | Action | Effort | Value |
|----------|--------|--------|-------|
| 1 | Add AutoTrader scraper | Medium | High — new dealer inventory, reliable data |
| 2 | Re-enable CL via proxy | Low (code done) | Medium — some unique private listings |
| 3 | Add OfferUp scraper | Medium | Medium — private sellers only |
