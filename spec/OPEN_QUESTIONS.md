# CarMatch — Open Questions

---

## Blockers (must resolve before build starts)

### ~~OQ-1~~ — Facebook Marketplace URL Structure — RESOLVED

**Confirmed URL pattern:**

```text
https://www.facebook.com/marketplace/{city-slug}/vehicles/?maxMileage={miles}&maxYear={year}&make={fb-make-id}&model={fb-model-id}&exact=false
```

**Example (Tampa, Toyota Camry, ≤2020, ≤100k miles):**

```text
https://www.facebook.com/marketplace/tampa/vehicles/?maxMileage=100000&maxYear=2020&make=2318041991806363&model=582109948940125&exact=false
```

**Confirmed parameters:**

| Parameter | Example | Notes |
| --- | --- | --- |
| `{city-slug}` (path) | `tampa` | City name in URL path, not a query param |
| `maxMileage` | `100000` | Integer, miles |
| `maxYear` | `2020` | Integer — FB only exposes max year in URL (see OQ-16) |
| `make` | `2318041991806363` | **Numeric FB ID, not a string** — see OQ-NEW-1 |
| `model` | `582109948940125` | **Numeric FB ID, not a string** |
| `exact` | `false` | Always set to false |
| `maxPrice` | `15000` | Confirmed — integer, dollars |
| `minYear` | `2018` | Confirmed — see OQ-16 |
| radius | N/A | **Not a URL param** — stored server-side — see OQ-16 |

**Impact on architecture:**

- `search_profiles.location` stores a city slug (e.g., `tampa`), not a ZIP or full city name
- Make/model are stored as both a display name and a numeric FB ID (see OQ-NEW-1)
- `brands.ts` must map Japanese brand names → FB make IDs

---

### ~~OQ-2~~ — Facebook Marketplace DOM Selector Map — RESOLVED

**Confirmed selectors** (documented in full in `docs/scraper.md`):

| Field | Strategy | Notes |
| --- | --- | --- |
| Card root | `a[href*="/marketplace/item/"]` | Entire card is an anchor |
| Listing ID | regex `/item\/(\d+)/` on href | |
| Full URL | `https://www.facebook.com` + href pathname | Strip query string |
| Image src | `img` inside card, `src` attr | CDN URL, expires in ~24-72h |
| Title | `img[alt]` — split on ` in ` → left part | e.g. `"2018 Toyota rav4 LE Sport Utility 4D"` |
| Location | `img[alt]` — split on ` in ` → right part | e.g. `"Orlando, FL"` |
| Year | regex `/^(19\|20)\d{2}/` from title | Always first token |
| Price | first `span[dir="auto"]` text matching `/^\$[\d,]+$/` | Parse: strip `$` and `,` |
| Mileage | `span[dir="auto"]` text matching `/[\d.,]+K?\s*miles?/i` | Parse: `95K` → `95000` |
| Seller type | Not available in card DOM | Leave null; requires detail page |

**Do NOT use class names** — all are obfuscated (e.g. `x78zum5`, `xkh6y0r`) and change without notice.

**Most stable field:** `img[alt]` — FB populates it as `"{title} in {location}"` and it is required for accessibility, making it less likely to change than visual class names.

**Implementation:** `src/scraper/marketplace.ts` is written and ready.

---

### ~~OQ-3~~ — carfax.shop DOM Selector Map — RESOLVED

**URL pattern confirmed:** `https://api.carfax.shop/report/view?hash=<hash>` (not `carfax.shop/...`)

**Confirmed selectors:**

| Field | Selector / Strategy |
| --- | --- |
| Accident count | `.accident-damage-record` element count |
| Owners | `.history-overview-row` text matching `/(\d+) Previous owner/i` |
| Last odometer | `.history-overview-row` text matching `/([\d,]+) Last reported odometer/i` |
| Title issues | `.common-section-cell-alert` inside `#title-history-section` |
| Odometer rollback | `.record-odometer-reading` values — check for any decrease in sequence |

**Odometer note:** CARFAX does not show an explicit "rollback" badge. Detection relies on:

1. Any decrease in consecutive `.record-odometer-reading` values in the history timeline
2. CARFAX's `lastOdometer` > listing's claimed mileage (checked at verdict time in `verdict.ts`)

**Input flexibility:** Parser accepts raw HTML. User can provide either:

- The `api.carfax.shop` report URL (Playwright fetches it, or plain `fetch()` if SSR)
- A saved HTML file uploaded directly to the Telegram bot (no Playwright needed — cheerio parses it)

**PDF option:** A PDF of the report can also be parsed (text extraction via `pdf-parse`), but HTML is preferred as it preserves DOM structure.

**Implementation:** `src/lib/carfax/parser.ts` and `src/lib/carfax/verdict.ts` — complete.

---

### ~~OQ-4~~ — Facebook Listing ID Extraction — RESOLVED

**Confirmed:** Listing ID is directly in the URL path. No redirect, no data attribute needed.

```text
https://www.facebook.com/marketplace/item/931397769542663/
                                          └─ listing ID ──┘
```

Regex `/item\/(\d+)/` on `href` extracts it reliably. Already implemented in `src/scraper/marketplace.ts`.

**Bonus — detail page fields (not available in search cards):**

The listing detail page exposes structured data not present in search result cards:

| Field | Example | Notes |
| --- | --- | --- |
| Exact mileage | "Driven 126,267 miles" | More precise than card's "126K miles" |
| Transmission | "Automatic transmission" | Not on card |
| Exterior/interior color | "Silver · Black" | Not on card |
| NHTSA safety rating | "5/5 overall" | Not on card |
| Owner count | "1 owner" | FB's own data — useful pre-Carfax signal |
| Lien status | "This vehicle is paid off" | Not on card |

These are available if the scraper loads the detail page per listing. Not done in v1 (too slow for bulk scraping), but "1 owner" is a useful pre-filter. See PM-14.

---

### OQ-5 — Playwright on DigitalOcean Droplet (Headless Chromium)
**Question:** Does Playwright's bundled Chromium run cleanly on a DigitalOcean Basic Droplet (1 vCPU, 1GB RAM) without additional configuration?

**Why it matters:** Playwright requires system dependencies (shared libraries) that may not be pre-installed on a minimal Debian/Ubuntu image.

**Resolution path:**
1. Provision the VPS
2. Run `npx playwright install --with-deps chromium`
3. Run a basic Playwright test script to confirm headed-less Chromium works
4. Note any missing system packages and add to `docs/setup.md`

**Likely fix if issues arise:** `apt install -y libgbm-dev libxkbcommon-dev libgtk-3-dev libasound2`

---

### ~~OQ-NEW-1~~ — Facebook Make/Model Numeric IDs — RESOLVED

**Complete brand ID map** (hard-code in `src/scraper/brands.ts`):

| Brand | FB Make ID |
| --- | --- |
| Toyota | `2318041991806363` |
| Honda | `308436969822020` |
| Mazda | `410067716491465` |
| Nissan | `2621742507840619` |
| Lexus | `2101813456521413` |
| Infiniti | `1361484827327051` |
| Acura | `280909549507187` |

**`brands.ts` constant:**

```typescript
export const JAPANESE_BRANDS: Record<string, string> = {
  toyota:   '2318041991806363',
  honda:    '308436969822020',
  mazda:    '410067716491465',
  nissan:   '2621742507840619',
  lexus:    '2101813456521413',
  infiniti: '1361484827327051',
  acura:    '280909549507187',
}
```

**Also noted from discovery URLs:** A `carType` parameter exists (e.g., `carType=sedan`). This can be added to the profile form later as a nice-to-have filter. Omit it for v1 (default = any body style). See PM-13 in Post-MVP.

---

### ~~OQ-16~~ — `minYear` and Radius URL Parameters — RESOLVED

**`minYear` — CONFIRMED** from URL: `&minYear=2020&maxYear=2020`

Both params work. `marketplace.ts` already sets `minYear` from `profile.minYear`. The `min_year` caveat in the schema can be removed — URL-level filtering works, post-filter is belt-and-suspenders only.

**Radius — CONFIRMED NOT a URL parameter.** Tested by setting radius to 1 mile in the FB filter UI and copying the resulting URL — no radius param appears anywhere in the query string. FB Marketplace stores the radius preference server-side (tied to the user's account/session), not in the URL. The `radius_miles` field in `search_profiles` is therefore a no-op and cannot be applied at URL-build time. Post-filtering by distance is also impractical without geocoding. This is a permanent limitation, not a pending investigation.

---

## Edge Cases & Spec Gaps

### OQ-6 — Listing Price Format Variations
**Question:** FB Marketplace listings can show price as:
- A specific number: `$12,500`
- "Price not listed"
- "Free"
- A range: `$10,000–$15,000`

**Current spec:** `price` field is `integer | null`. Null covers "not listed."

**Gap:** How to handle "Free" (store as 0?) and price ranges (store min, max, or discard?). For a car search, "Free" is almost certainly spam — filter it out or store as null. Price ranges: store the lower bound for filter matching.

**Decision needed:** Add to schema or filter in scraper?

---

### OQ-7 — Mileage and Year Extraction from Title
**Question:** FB Marketplace listing cards may not expose mileage and year as structured fields — they may only appear in the listing title (e.g., "2019 Honda Civic 67k miles") or in the listing body (not visible in search results).

**Why it matters:** Profile matching filters on mileage and year — if these aren't extractable from the card, filtering is impossible.

**Resolution options:**
- If mileage/year are in the card subtitle: extract with regex
- If not in the card at all: load each listing's detail page (much slower, 1 extra page per listing)
- Fallback: match only on price and make/model from the card; accept more false positives

**Recommended approach:** Try regex extraction from card text first. If fields are missing for > 50% of listings, load detail pages for unfiltered candidates.

---

### OQ-8 — Bot Command Parsing for `/carfax {id} {url}`
**Question:** The spec defines `/carfax {url}` and `/carfax {id} {url}` as separate command forms. grammY command handlers receive the full message text — parsing the two-argument form requires detecting whether the first argument is a number (listing ID) or a URL.

**Implementation note:** Parse with a regex: if the first token after `/carfax ` matches `/^\d+$/`, treat it as a listing ID and the second token as the URL. Otherwise treat the entire argument as a URL. Edge case: what if the user sends just `/carfax` with no arguments?

---

### ~~OQ-9~~ — Carfax URL Validation — RESOLVED

**Confirmed URL pattern:** `https://api.carfax.shop/report/view?hash=<hex-encoded-hash>`

The hash is a long hex string (not a VIN). VIN validation at the URL level is not possible.

**Validator:** Accept URLs matching `/^https:\/\/api\.carfax\.shop\/report\/view\?hash=/`.

**Also accepted (HTML file upload):** User can upload a saved HTML file directly to the bot instead of pasting a URL. The bot detects the input type (URL string vs file attachment) and routes accordingly. No URL validation needed for the file upload path.

---

### OQ-10 — node-cron Interval Per Profile
**Question:** The spec says "configurable per search profile" for scrape interval, but the `search_profiles` schema does not include a `scrape_interval_minutes` field. The env var `SCRAPE_INTERVAL_MINUTES` is global.

**Current state:** One global interval for all profiles.

**Decision:** For v1, a single global interval is acceptable. If per-profile intervals are needed later, add a `scrape_interval_minutes` column to `search_profiles` and adjust the cron job registration logic. Not a blocker.

---

### OQ-11 — What Happens When the Worker Restarts Mid-Scrape
**Question:** If pm2 restarts the worker while a Playwright scrape cycle is in progress, what is the DB state?

**Risk:** A listing may have been inserted but the alert not yet sent — or the alert was sent but `alerted_at` wasn't written back.

**Mitigation:** Write `alerted_at` to the DB only after the Telegram message is confirmed sent (grammY `sendMessage` resolves on success). If the worker restarts before this, the listing remains in the DB with `alerted_at = null`. Add a recovery check on worker startup: find listings with `alerted_at = null` created in the last 10 minutes and re-send their alerts.

---

### OQ-12 — Image URL Lifetime
**Question:** FB Marketplace image URLs are typically CDN-signed URLs with an expiry (often 24–72 hours). The dashboard's listing thumbnails may break after the URL expires.

**Options:**
- Accept broken images after expiry (simplest — just show a car icon placeholder)
- Download and store images locally on the VPS at scrape time (adds disk usage and complexity)

**Recommendation for v1:** Accept broken images. Show a placeholder icon when the `<img>` fails to load (`onError` handler in React). Note this as a post-MVP improvement.

---

### OQ-13 — Scraper Rate Limiting Strategy
**Question:** The spec mentions "randomized polling intervals (2,000–8,000ms delay)" but doesn't specify exactly where delays are applied — between page loads, between listing extractions, or both.

**Clarification needed:**
- Delay between navigating to the search results page and extracting listings: 2–4 seconds (page load)
- Delay between scraping profile A's results and profile B's: 5–10 seconds
- No delay needed between individual listing card extractions (all on same page)

---

## Conflicts Between Requirements

### OQ-14 — Rejected Listings Visibility
**Conflict:** The spec says rejected listings are "never surfaced again" and "hidden from all other views." However, the Listings page has a "Rejected" tab that shows them.

**Resolution:** "Never surfaced again" applies to Telegram alerts (don't re-alert) and all non-rejected filter views (All, New, Interested, Contacted tabs). The Rejected tab in the dashboard intentionally surfaces them for review/audit. This is the correct behavior — the spec is slightly ambiguous. No change to implementation, but the wording should be clear in code comments.

---

### OQ-15 — Carfax Linked to Listing: When Listing Was Not in DB
**Conflict:** The Telegram `/carfax` command accepts an optional listing ID. But what if the user pastes a Carfax URL for a listing they found manually (not through the scraper) — no DB record exists.

**Current schema:** `carfax_reports.listing_id` is nullable — this case is handled (report stored without a linked listing).

**Gap:** The bot's `/carfax {id} {url}` form could fail if the ID doesn't exist. The handler should validate that the listing ID exists before linking, and respond with a clear error if not.

---

## Post-MVP Improvements

These are explicitly out of scope for v1 but worth capturing for later.

| ID | Idea | Trigger to Add |
|---|---|---|
| PM-1 | **Price drop tracking** — alert if a watched listing drops in price | After successful purchase, for future use |
| PM-2 | **Image archival** — download listing images to disk on scrape | If broken thumbnails become annoying |
| PM-3 | **Multiple alert channels** — email or webhook in addition to Telegram | If Telegram is ever unavailable or unsuitable |
| PM-4 | **Automated seller contact message** — draft a template message to send | Only if the tool saves time on purchase workflow |
| PM-5 | **Listing score / ranking** — combine price, mileage, year into a deal score | After enough data is collected to calibrate |
| PM-6 | **Carfax VIN input** — accept a VIN and look up the report automatically | If carfax.shop supports VIN-based lookup |
| PM-7 | **Notes field on listings** — add free-text notes per listing | After first use reveals the need |
| PM-8 | **Mobile-optimized dashboard** — improve mobile layout | If Telegram bot proves insufficient for mobile triage |
| PM-9 | **Export to CSV** — export listings + Carfax results | For post-purchase analysis |
| PM-10 | **Carfax field: service history** — parse number of service records | If available in carfax.shop DOM |
| PM-11 | **Upgrade to CX21 / add swap** | If Playwright causes OOM on CX11 |
| PM-12 | **Automated DB backup** — cron job to copy `.db` file to S3 or local | After initial setup is stable |
| PM-13 | **Body style filter (`carType`)** — add sedan/SUV/truck/etc. filter to search profiles | Confirmed FB URL param exists; low effort to add |
| PM-14 | **Detail page scrape** — load each listing page to get exact mileage, owner count, lien status, transmission | If card data proves too imprecise for filtering |
