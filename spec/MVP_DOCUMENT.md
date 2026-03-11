# CarMatch — MVP Implementation Spec

---

## Project Overview

CarMatch is a single-user, self-hosted tool that continuously monitors Facebook Marketplace for used car listings matching configurable search profiles, delivers real-time Telegram alerts, and evaluates deal quality by parsing Carfax reports. The system eliminates manual browsing by running a persistent scraper on a DigitalOcean Droplet, deduplicating listings, and surfacing only matching results. A lightweight Next.js dashboard serves as the control plane for search profile management, listing status tracking, and Carfax report history.

| Layer | Choice |
|---|---|
| Language | TypeScript (strict mode) |
| Scraper | Playwright (persistent browser context) |
| Backend + Dashboard | Next.js 14 App Router |
| Database | SQLite via Drizzle ORM |
| Telegram Bot | grammY (polling mode) |
| Job Scheduler | node-cron |
| Styling | Tailwind CSS + shadcn/ui (dark theme) |
| Hosting | DigitalOcean Droplet (Basic 1GB, ~$6/mo) + pm2 |
| Runtime | Node.js 20 LTS |

---

## Design System

### Colors

| Token | Hex | Usage |
|---|---|---|
| `bg-base` | `#0f0f0f` | Page background |
| `bg-card` | `#161616` | Card and panel backgrounds |
| `bg-muted` | `#1f1f1f` | Table rows (alt), input backgrounds |
| `border` | `#2a2a2a` | All borders, dividers |
| `text-primary` | `#f0f0f0` | Body text, headings |
| `text-muted` | `#6b7280` | Secondary labels, timestamps |
| `accent-emerald` | `#10b981` | Pass verdict, status: interested, active indicators |
| `accent-red` | `#ef4444` | Fail verdict, status: rejected |
| `accent-yellow` | `#f59e0b` | Status: contacted, warnings |
| `accent-blue` | `#3b82f6` | Links, focus rings |
| `text-new` | `#94a3b8` | Status: new (neutral) |

### Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Headings | Inter | 600 | 18–24px |
| Body | Inter | 400 | 14px |
| Data fields (price, mileage) | JetBrains Mono | 500 | 13–14px |
| Labels / badges | Inter | 500 | 12px |
| Code / selectors | JetBrains Mono | 400 | 12px |

Load both fonts via `next/font`. JetBrains Mono is used wherever numbers have data significance (price, mileage, year, odometer, accident count).

### Effects

- **Border radius:** `rounded-md` (6px) for cards, `rounded-sm` (4px) for badges/inputs
- **Card shadow:** none — rely on border contrast against dark background
- **Focus ring:** `ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0f0f0f]`
- **Table rows:** alternating `bg-[#161616]` / `bg-[#0f0f0f]`, hover `bg-[#1f1f1f]`
- **Badge style:** solid background, no border, 4px radius, uppercase 11px tracking-wide

---

## Pages & Features

### Page 1 — `/` Listings

The main view. Shows all scraped listings that matched any active profile.

**Layout:** Full-width table with a sticky filter bar above it.

**Filter bar (horizontal row):**
- Status tab group: `All` | `New` | `Interested` | `Contacted` | `Rejected` — each shows a count badge
- Profile dropdown: filters by search profile (`All Profiles` default)
- Search input: filters by title text (client-side)
- Results count label: "Showing 24 of 47 listings"

**Table columns:**
| Column | Content | Notes |
|---|---|---|
| (thumbnail) | 48×48 image or car icon placeholder | Links to detail page |
| Title | Full listing title | Truncated to 2 lines, links to detail page |
| Price | `$12,500` | Monospace font, right-aligned |
| Year | `2019` | Monospace |
| Mileage | `67,000 mi` | Monospace |
| Location | City, State | Muted text |
| Profile | Badge with profile name | Color-coded if multiple profiles |
| Carfax | `PASS` / `FAIL` / `—` badge | Emerald/red/muted |
| Status | Dropdown: New / Interested / Contacted / Rejected | Inline, triggers PATCH immediately |
| Alerted | Relative timestamp (e.g., "2h ago") | Muted text |
| Actions | External link icon → FB listing URL | Opens in new tab |

**Behavior:**
- Status changes are immediate (optimistic update, revert on error)
- Rejected listings shown only when "Rejected" tab is active — hidden from all other views
- Rows are sorted by `alerted_at` descending (newest first)
- Pagination: 25 rows per page, page controls at bottom

---

### Page 2 — `/listings/[id]` Listing Detail

Two-panel layout for side-by-side evaluation of a listing and its Carfax report.

**Left panel — Listing Info:**
- Thumbnail image (full width of panel, max 300px tall, object-cover)
- Title (h1, 20px)
- Status selector (dropdown, same options as table)
- Data grid (label + monospace value):
  - Price
  - Year
  - Mileage
  - Location
  - Seller type (Private / Dealer)
  - Profile matched
  - First seen (absolute timestamp)
  - Alert sent (absolute timestamp or "Not alerted")
- "View on Facebook" button — primary, opens FB URL in new tab

**Right panel — Carfax:**

*If no report exists:*
- "No Carfax report yet" heading
- Text input with placeholder: `Paste carfax.shop URL…`
- Submit button: "Parse Report"
- Shows loading spinner while parsing

*If report exists:*
- Report header: "Carfax Report" + parsed date (muted)
- Verdict badge: large, `PASS` (emerald) or `FAIL` (red) or `UNKNOWN` (muted)
- If FAIL: list of verdict reasons as red bullets
- Data grid:
  - Accidents: count (red if > 0)
  - Owners: count
  - Title Issues: list or "None"
  - Odometer Rollback: Yes (red) / No (green)
- Raw carfax URL (muted, small, link)
- "Re-parse" button (ghost) — allows re-running if selectors changed

**Behavior:**
- Submitting a Carfax URL from the detail page POSTs to `/api/carfax` with `listingId` pre-filled
- After parsing, right panel refreshes with result (no full page reload)

---

### Page 3 — `/profiles` Search Profiles

Manage the set of active search criteria.

**Layout:** Left list of profiles + right form panel (or modal on smaller screens).

**Profile list item:**
- Profile name
- Summary line: make/model or "Any", price cap, mileage cap, year floor, location + radius
- Active toggle (switch, updates inline)
- Edit / Delete buttons

**Profile form (create or edit):**
| Field | Type | Required | Notes |
|---|---|---|---|
| Name | text | yes | e.g., "Toyota Camry < 15k" |
| Make | select | no | Dropdown of supported Japanese brands (Toyota, Honda, Mazda, Nissan, Lexus, Infiniti, Acura). Stores lowercase brand key. |
| Model | text | no | FB numeric model ID — leave blank to match all models for the selected make |
| Min Year | number | no | e.g., 2016 — applied as post-filter on scraped results |
| Max Price | number | no | In dollars, no cents |
| Max Mileage | number | no | In miles |
| Location | text | yes | City slug for FB Marketplace, e.g., `tampa` |
| Radius | number | yes | Default 50, in miles |
| Include Private | checkbox | yes | Default: checked |
| Include Dealers | checkbox | yes | Default: checked |
| Japanese brands only | checkbox | yes | Default: checked. Filters to Toyota, Honda, Mazda, Nissan, Lexus, Infiniti, Acura. Applied even when Make is blank. |
| Active | checkbox | yes | Default: checked |

**Behavior:**
- Deleting a profile does NOT delete listings that were matched by it — they remain with their status
- Cannot delete the last active profile while the scraper is running (show warning)
- Profile changes take effect on next scheduled scrape cycle

---

### Page 4 — `/carfax` Carfax History

All Carfax reports ever parsed, regardless of listing association.

**Layout:** Table view.

**Table columns:**
| Column | Content |
|---|---|
| Parsed | Relative timestamp |
| Carfax URL | Truncated link (opens in new tab) |
| Linked Listing | Title link to listing detail, or "—" |
| Verdict | PASS / FAIL / UNKNOWN badge |
| Accidents | Number (red if > 0) |
| Owners | Number |
| Odometer Rollback | Yes / No |

**Filter:** Verdict dropdown (All / Pass / Fail / Unknown)

**Behavior:** Clicking a row expands it to show full report details inline. No separate detail page needed.

---

### Nav / Layout

- Persistent left sidebar (desktop) or top nav (mobile)
- Nav items: Listings, Profiles, Carfax History
- Active scraper status indicator in the sidebar footer: "Scraper: Active" (green dot) / "Scraper: Error" (red dot) — this calls a `/api/status` health endpoint
- App title: "CarMatch" — no logo, text only

---

## Data Architecture

### Database Schema

All timestamps stored as ISO 8601 strings in UTC. Booleans stored as integers (0/1) per SQLite convention with Drizzle `{ mode: 'boolean' }`.

#### Table: `search_profiles`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK, autoincrement | |
| `name` | text | not null | Display name |
| `make` | text | nullable | Lowercase brand key, e.g., `"toyota"`. Resolved to FB numeric ID at scrape time via `brands.ts`. |
| `model` | text | nullable | FB numeric model ID, e.g., `"582109948940125"`. Omit param if null. |
| `min_year` | integer | nullable | Year floor — passed as `minYear` URL param (confirmed) and also applied as post-filter |
| `max_price` | integer | nullable | In dollars |
| `max_mileage` | integer | nullable | In miles |
| `location` | text | not null | City slug for FB Marketplace URL path, e.g., `"tampa"` |
| `radius_miles` | integer | not null, default 50 | FB Marketplace radius filter |
| `include_private` | integer (bool) | not null, default 1 | |
| `include_dealers` | integer (bool) | not null, default 1 | |
| `japanese_only` | integer (bool) | not null, default 1 | Filter to Toyota, Honda, Mazda, Nissan, Lexus, Infiniti, Acura only |
| `is_active` | integer (bool) | not null, default 1 | Inactive profiles are skipped by scraper |
| `created_at` | text | not null, default CURRENT_TIMESTAMP | |
| `updated_at` | text | not null, default CURRENT_TIMESTAMP | Manually updated on writes |

#### Table: `listings`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK, autoincrement | |
| `fb_listing_id` | text | not null, unique | FB's own ID — used for deduplication |
| `profile_id` | integer | FK → search_profiles.id, nullable | Null if profile deleted |
| `title` | text | not null | Full listing title as scraped |
| `price` | integer | nullable | In dollars, null if unlisted |
| `mileage` | integer | nullable | In miles, null if unlisted |
| `year` | integer | nullable | Model year |
| `location` | text | nullable | City/area as shown on listing |
| `fb_url` | text | not null | Full FB Marketplace listing URL |
| `image_url` | text | nullable | First listing image URL |
| `seller_type` | text | nullable | `'private'` or `'dealer'` |
| `status` | text | not null, default `'new'` | `'new'` / `'interested'` / `'rejected'` / `'contacted'` |
| `alerted_at` | text | nullable | When Telegram alert was sent |
| `created_at` | text | not null, default CURRENT_TIMESTAMP | |
| `updated_at` | text | not null, default CURRENT_TIMESTAMP | |

Index: `fb_listing_id` (unique, used on every dedup check)
Index: `status` (filtered in most dashboard queries)

#### Table: `carfax_reports`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | integer | PK, autoincrement | |
| `listing_id` | integer | FK → listings.id, nullable | Null if submitted without linking to a listing |
| `carfax_url` | text | not null | The carfax.shop URL as submitted |
| `accident_count` | integer | nullable | Null if parsing failed for this field |
| `owner_count` | integer | nullable | |
| `title_issues` | text | nullable | JSON array of strings, e.g. `["Salvage title"]` |
| `odometer_rollback` | integer (bool) | nullable | |
| `raw_summary` | text | nullable | Full extracted page text, for debugging |
| `verdict` | text | not null, default `'unknown'` | `'pass'` / `'fail'` / `'unknown'` |
| `verdict_reasons` | text | nullable | JSON array of reason strings explaining FAIL |
| `parsed_at` | text | nullable | When Playwright finished parsing |
| `created_at` | text | not null, default CURRENT_TIMESTAMP | |

---

### API Endpoints

All API routes live under `/api/`. All routes are protected by a session cookie check (see Security section). All request bodies are JSON. All responses are JSON.

#### Listings

**`GET /api/listings`**
- Query: `status` (new/interested/rejected/contacted), `profile_id` (number), `q` (title search), `page` (default 1), `limit` (default 25)
- Response: `{ listings: Listing[], total: number, page: number, pages: number }`
- Notes: When `status` is omitted, returns all except rejected. Returns rejected only when `status=rejected`.

**`GET /api/listings/:id`**
- Response: `{ listing: Listing, carfaxReport: CarfaxReport | null }`

**`PATCH /api/listings/:id/status`**
- Body: `{ status: 'new' | 'interested' | 'rejected' | 'contacted' }`
- Response: `{ listing: Listing }`
- Notes: Setting `rejected` causes listing to be excluded from all non-rejected dashboard views and suppresses future re-alerts.

#### Search Profiles

**`GET /api/search-profiles`**
- Response: `{ profiles: SearchProfile[] }`

**`POST /api/search-profiles`**

- Body: `{ name, make?, model?, minYear?, maxPrice?, maxMileage?, location, radiusMiles, includePrivate, includeDealers, japaneseOnly }`
- Response: `{ profile: SearchProfile }`

**`PATCH /api/search-profiles/:id`**
- Body: Partial of above fields + optional `isActive`
- Response: `{ profile: SearchProfile }`

**`DELETE /api/search-profiles/:id`**
- Response: `{ success: true }`
- Notes: Hard delete. Listings matched to this profile retain their records with `profile_id` set to null.

#### Carfax

**`POST /api/carfax`**
- Body: `{ url: string, listingId?: number }`
- Response: `{ report: CarfaxReport }`
- Notes: This triggers synchronous Playwright parsing — response may take 10–30 seconds. Client should show a loading state. Validate that `url` starts with `https://carfax.shop/` before processing.

**`GET /api/carfax`**
- Query: `verdict` (pass/fail/unknown), `listing_id`, `page`, `limit`
- Response: `{ reports: CarfaxReport[], total: number, page: number, pages: number }`

**`GET /api/carfax/:id`**
- Response: `{ report: CarfaxReport, listing: Listing | null }`

#### Health

**`GET /api/status`**
- Response: `{ scraper: 'active' | 'error' | 'idle', lastRunAt: string | null, nextRunAt: string | null, activeProfiles: number }`
- Notes: The worker writes a heartbeat timestamp to a local JSON file (`data/status.json`) after each scrape cycle. This endpoint reads that file. No DB query needed.

---

### Verdict Logic

A Carfax report is scored `fail` if **any** of the following are true:
- `accident_count > 0`
- `title_issues` array has at least one entry
- `odometer_rollback === true`

Otherwise it is scored `pass` if all three fields parsed successfully. If any field is null (parsing error), the verdict is `unknown`.

`verdict_reasons` is populated with human-readable strings for each triggered condition:
- `"${accident_count} accident(s) on record"`
- `"Title issue: ${issue}"` (one entry per issue)
- `"Odometer rollback detected"`

---

## Admin Workflow

This is a single-user tool. "Admin" means the owner managing their own data. No separate admin role exists.

### Setting Up a New Search Profile
1. Open dashboard → Profiles
2. Click "Add Profile"
3. Fill in: Name, Make/Model (optional), Min Year, Max Price, Max Mileage, Location, Radius
4. Toggle Include Private / Include Dealers as needed
5. Save — profile is immediately active
6. Next scraper cycle (within ~5 min) will begin checking this profile
7. Estimated time: ~2 minutes

### Evaluating and Triaging Listings
1. Receive Telegram alert for new listing
2. Tap the listing link to view on Facebook
3. Reply to the Telegram alert with `/interested [id]`, `/reject [id]`, or `/contact [id]` — or open dashboard
4. If interested: paste the carfax.shop URL into the bot or the listing detail page
5. Review Carfax verdict and reasons
6. Update status to `contacted` if pursuing, or `rejected` if Carfax fails
7. Estimated time per listing: 3–5 minutes including Carfax review

### Refreshing Facebook Session (when scraper is blocked)
1. SSH into Droplet
2. Run `npm run fb:login` (a one-off script that opens Playwright in headed mode via VNC or Xvfb)
3. Log in manually — Playwright saves the session to `data/fb-session.json`
4. Restart worker: `pm2 restart worker`
5. See `docs/scraper.md` for full steps
6. Estimated time: 10–15 minutes

### Updating Carfax DOM Selectors (when parsing breaks)
1. Run `carfax.shop` URL manually in browser, inspect elements
2. Update selectors in `src/lib/carfax/parser.ts`
3. Test with `npm run carfax:test [url]`
4. Deploy with `./scripts/deploy.sh`
5. See `docs/carfax.md` for selector map
6. Estimated time: 20–40 minutes

---

## User Flows

### Flow 1 — New Listing Alert

1. node-cron triggers the scrape job every N minutes (configurable per profile via `SCRAPE_INTERVAL_MINUTES`)
2. Scraper opens Facebook Marketplace search URL for the profile's criteria
3. Playwright extracts listing cards: `fb_listing_id`, title, price, mileage, year, location, image URL, seller type
4. For each extracted listing:
   a. Check if `fb_listing_id` already exists in `listings` table → skip if yes
   b. Check if it matches profile criteria (price ≤ max, mileage ≤ max, year ≥ min, seller type allowed, make in allowed brands list if `japanese_only = true`) → skip if no
   c. Insert into `listings` with `status = 'new'`
   d. Send Telegram alert to owner (formatted message + inline keyboard)
   e. Update `alerted_at` on the listing record
5. Scraper writes heartbeat to `data/status.json`

### Flow 2 — Carfax via Telegram

1. Owner receives or recalls a listing and obtains a `carfax.shop` URL
2. Owner sends message to bot: `/carfax https://carfax.shop/ABC123` (optionally with listing ID: `/carfax ABC123 https://carfax.shop/ABC123`)
3. Bot responds: "Parsing report, please wait…"
4. Bot POSTs to `/api/carfax` with the URL (and `listingId` if provided)
5. Server launches Playwright, loads the carfax.shop page, extracts fields
6. Verdict is computed, report is stored in DB
7. Bot sends formatted Carfax summary message (see Telegram Message Formats)
8. If `listingId` was provided, bot appends: "Report linked to listing #[id]"

### Flow 3 — Carfax via Dashboard

1. Owner opens listing detail page for a listing of interest
2. Right panel shows "No Carfax report yet" with URL input
3. Owner pastes `carfax.shop` URL and clicks "Parse Report"
4. Loading spinner appears, button is disabled
5. POST to `/api/carfax` with `{ url, listingId }` — response may take up to 30s
6. On success: right panel updates to show full report and verdict badge
7. On error: red error toast with message (timeout, parse failure, etc.)

### Flow 4 — Listing Status Update via Telegram

1. Owner receives alert for listing #42
2. Sends: `/reject 42`
3. Bot responds: "Listing #42 marked as Rejected. It will not be surfaced again."
4. DB updates `listings.status = 'rejected'` and `updated_at`

### Flow 5 — Managing Search Profiles

1. Owner opens dashboard → Profiles
2. Existing profile is showing too many mismatches on price
3. Owner clicks Edit → lowers `maxPrice` from 18000 to 15000
4. Saves — change takes effect next scrape cycle
5. Previously alerted listings are unaffected (they are not re-evaluated against updated criteria)

---

## Telegram Message Formats

### New Listing Alert

```
🚗 New Match — {title}

💰 {price}
📅 {year}
🛣️ {mileage} miles
📍 {location}
🏷️ {profile_name}

[View Listing →]

/interested_{id}  /reject_{id}  /contact_{id}
```

Notes:
- If price is null: show `Price not listed`
- If mileage is null: omit the mileage line
- Inline keyboard buttons for quick status update (grammY inline keyboard)

### Carfax Summary

```
📋 Carfax Report

✅ PASS  (or ❌ FAIL / ⚠️ UNKNOWN)

👤 Owners: {owner_count}
💥 Accidents: {accident_count}
📜 Title: {title_issues or "Clean"}
🔄 Odometer: {rollback_text}

{verdict_reasons as bullet list, if FAIL}
```

### Bot Commands

| Command | Description |
|---|---|
| `/start` | Welcome message, lists commands |
| `/recent` | Shows 5 most recent New/Interested listings |
| `/interested {id}` | Marks listing as Interested |
| `/reject {id}` | Marks listing as Rejected |
| `/contact {id}` | Marks listing as Contacted |
| `/carfax {url}` | Parses a Carfax report, no listing link |
| `/carfax {id} {url}` | Parses and links to listing |
| `/help` | Lists all commands |

All commands silently ignore requests from any `chat_id` other than `TELEGRAM_ALLOWED_USER_ID`.

---

## Empty States

| Section | Empty State |
|---|---|
| Listings table (no results at all) | "No listings yet. The scraper will surface matches here once it runs." |
| Listings table (filtered to a status with no results) | "No {status} listings." |
| Listings table (search query returns nothing) | "No listings match '{query}'." |
| Profiles list | "No search profiles. Add one to start monitoring." |
| Carfax history | "No Carfax reports yet. Paste a carfax.shop URL in a listing detail page or via the Telegram bot." |
| Listing detail, no Carfax | "No Carfax report yet." + URL input |
| Carfax detail, no linked listing | "—" in the Listing column |

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Behavior |
|---|---|---|
| Mobile | < 640px | Single-column. Nav collapses to top hamburger menu. Tables become stacked card list. Detail page becomes single column (Carfax below listing info). Form fields full-width. |
| Tablet | 640–1024px | Sidebar visible but icon-only (collapsed). Tables show abbreviated columns. Detail page still single-column. |
| Desktop | > 1024px | Full sidebar with labels. Full table with all columns. Detail page two-panel side-by-side. Profile list + form side by side. |

Note: This is primarily a desktop tool. Mobile layout should be functional but is not the priority use case. The Telegram bot handles mobile interaction.

---

## Security

### Dashboard Authentication
- Single-user auth via a secret token stored in `DASHBOARD_SECRET` env var
- On first visit, redirect to `/login` — a simple form with a password field
- On correct submission, set an `HttpOnly`, `Secure`, `SameSite=Strict` cookie (`carmatch_session`) signed with `DASHBOARD_SECRET`
- All API routes and pages check for this cookie via Next.js middleware (`src/middleware.ts`)
- Exclude `/login` and `/api/auth/*` from middleware protection

### Telegram Bot Authorization

- Every grammY handler has a middleware that checks `ctx.from?.id === Number(process.env.TELEGRAM_ALLOWED_USER_ID)`
- Unknown users receive no response (silent drop) — do not reply with an error message that confirms the bot exists

### Input Validation
- All API request bodies validated with Zod schemas before any DB operation
- Carfax URL: must match `/^https:\/\/carfax\.shop\//` before Playwright loads it
- Number fields: range-checked (year ≥ 1900 ≤ 2030, price ≥ 0 ≤ 10,000,000, etc.)
- Status field: enum-checked against allowed values

### XSS Prevention
- Next.js JSX escapes all interpolated values by default — never use `dangerouslySetInnerHTML`
- External URLs (FB links, Carfax links) opened via `target="_blank" rel="noopener noreferrer"`
- No user-generated content is rendered as HTML

### Secrets Management
- `.env.local` is gitignored — never committed
- FB credentials (`FACEBOOK_EMAIL`, `FACEBOOK_PASSWORD`) are server-side only, never exposed to the client
- `NEXT_PUBLIC_` prefix is only used for non-sensitive values (e.g., app URL if needed)
- SQLite database file stored at `data/carmatch.db` — outside the `public/` directory
- Session file stored at `data/fb-session.json` — gitignored

### Rate Limiting / Bot Protection
- Playwright scraper uses randomized intervals between page loads (2,000–8,000ms delay)
- Scrape interval is configurable — default 5 minutes, not lower than 3
- Single browser context reused across scrape cycles (avoids repeated logins)
- If a scrape cycle throws a navigation error, it is caught and logged — worker continues to next cycle

---

## Project Structure

```
/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (dashboard)/              # Route group — all protected pages share layout
│   │   │   ├── layout.tsx            # Dashboard shell: sidebar nav, auth check
│   │   │   ├── page.tsx              # / — Listings table page
│   │   │   ├── listings/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # /listings/[id] — Listing detail page
│   │   │   ├── profiles/
│   │   │   │   └── page.tsx          # /profiles — Search profiles management
│   │   │   └── carfax/
│   │   │       └── page.tsx          # /carfax — Carfax history table
│   │   ├── login/
│   │   │   └── page.tsx              # /login — Password entry page
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── route.ts          # POST /api/auth — sets session cookie
│   │   │   ├── listings/
│   │   │   │   ├── route.ts          # GET /api/listings
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts      # GET /api/listings/:id
│   │   │   │       └── status/
│   │   │   │           └── route.ts  # PATCH /api/listings/:id/status
│   │   │   ├── search-profiles/
│   │   │   │   ├── route.ts          # GET, POST /api/search-profiles
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts      # PATCH, DELETE /api/search-profiles/:id
│   │   │   ├── carfax/
│   │   │   │   ├── route.ts          # GET, POST /api/carfax
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts      # GET /api/carfax/:id
│   │   │   └── status/
│   │   │       └── route.ts          # GET /api/status — scraper health
│   │   ├── layout.tsx                # Root layout: fonts, globals
│   │   └── globals.css               # Tailwind base imports, CSS custom properties
│   │
│   ├── bot/
│   │   ├── index.ts                  # Bot initialization, command registration, polling start
│   │   ├── commands/
│   │   │   ├── start.ts              # /start handler
│   │   │   ├── recent.ts             # /recent handler
│   │   │   ├── status.ts             # /interested, /reject, /contact handlers
│   │   │   ├── carfax.ts             # /carfax handler
│   │   │   └── help.ts               # /help handler
│   │   └── middleware/
│   │       └── auth.ts               # grammY middleware: owner ID check
│   │
│   ├── scraper/
│   │   ├── index.ts                  # Scraper orchestrator: runs all active profiles
│   │   ├── browser.ts                # Playwright browser singleton, session management
│   │   ├── marketplace.ts            # FB Marketplace page navigation and listing extraction
│   │   ├── session.ts                # FB login flow, cookie save/load (data/fb-session.json)
│   │   └── brands.ts                 # JAPANESE_BRANDS map: brand key → FB numeric make ID (all 7 brands hard-coded)
│   │
│   ├── jobs/
│   │   ├── index.ts                  # Registers all cron jobs, exports startJobs()
│   │   └── scrape.ts                 # Cron job: loads profiles, calls scraper, sends alerts
│   │
│   ├── db/
│   │   ├── index.ts                  # Drizzle client initialization (better-sqlite3)
│   │   ├── schema.ts                 # Full Drizzle schema: all tables and relations
│   │   └── migrations/               # Auto-generated by drizzle-kit generate
│   │
│   ├── lib/
│   │   ├── carfax/
│   │   │   ├── parser.ts             # Playwright-based DOM extraction from carfax.shop
│   │   │   └── verdict.ts            # Scoring logic: fields → pass/fail/unknown + reasons
│   │   ├── telegram/
│   │   │   ├── formatters.ts         # Message text builders for alerts and reports
│   │   │   └── keyboards.ts          # Inline keyboard builders (status buttons)
│   │   └── types/
│   │       └── index.ts              # Shared TypeScript interfaces: Listing, SearchProfile, CarfaxReport
│   │
│   └── middleware.ts                 # Next.js middleware: session cookie check on protected routes
│
├── worker.ts                         # Worker entry point: starts bot + cron jobs
│
├── scripts/
│   ├── deploy.sh                     # One-command deploy from local machine
│   └── fb-login.ts                   # One-off script: headed Playwright login to refresh FB session
│
├── data/                             # Runtime data — gitignored
│   ├── carmatch.db                   # SQLite database file
│   ├── fb-session.json               # Playwright browser session storage (FB cookies)
│   └── status.json                   # Worker heartbeat file (last run, next run, errors)
│
├── docs/
│   ├── setup.md                      # Fresh VPS to running: step-by-step
│   ├── scraper.md                    # Session refresh, block recovery, rate limit tuning
│   └── carfax.md                     # DOM selector map, fragile fields, re-mapping guide
│
├── .env.local                        # Secrets — never committed
├── .env.example                      # Template with placeholder values — committed
├── .gitignore
├── drizzle.config.ts                 # Drizzle Kit config: schema path, output path, dialect
├── next.config.ts                    # Next.js config: standalone output for VPS
├── package.json
├── pm2.config.js                     # pm2 app definitions: web + worker
├── tsconfig.json                     # Strict TypeScript config
└── tailwind.config.ts                # Tailwind config: dark mode, shadcn/ui integration
```

---

## Environment Variables

### `.env.example`

```bash
# ─── Telegram ────────────────────────────────────────────
# Bot token from @BotFather
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Your personal Telegram user ID (from @userinfobot)
TELEGRAM_ALLOWED_USER_ID=123456789

# ─── Dashboard Auth ──────────────────────────────────────
# Secret password for the dashboard login page
# Must be long and random — this is the only thing protecting the dashboard
DASHBOARD_SECRET=change-this-to-a-long-random-string

# ─── Facebook ────────────────────────────────────────────
# Facebook account credentials for Playwright login
# Use a dedicated account, not your personal account
FACEBOOK_EMAIL=your-fb-email@example.com
FACEBOOK_PASSWORD=your-fb-password

# ─── Database ────────────────────────────────────────────
# Absolute path to the SQLite file — adjust for your VPS
DATABASE_URL=/home/user/car-match/data/carmatch.db

# ─── Scraper ─────────────────────────────────────────────
# How often to scrape (minutes). Minimum recommended: 3
SCRAPE_INTERVAL_MINUTES=5

# ─── App ─────────────────────────────────────────────────
# Public URL of the dashboard (used for internal link generation)
NEXT_PUBLIC_APP_URL=http://your-vps-ip:3000
```

### Client vs Server Split

| Variable | Exposed to browser | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Never | Server + worker only |
| `TELEGRAM_ALLOWED_USER_ID` | Never | Server + worker only |
| `DASHBOARD_SECRET` | Never | Server middleware only |
| `FACEBOOK_EMAIL` | Never | Worker/scraper only |
| `FACEBOOK_PASSWORD` | Never | Worker/scraper only |
| `DATABASE_URL` | Never | Server only |
| `SCRAPE_INTERVAL_MINUTES` | Never | Worker only |
| `NEXT_PUBLIC_APP_URL` | Yes | Harmless public URL |

**Critical rules:**
- Never prefix secrets with `NEXT_PUBLIC_`
- Never log env vars (especially FB credentials) in any log output
- `.env.local` is gitignored — only `.env.example` is committed

---

## Implementation Order

Build in this exact order. Each step assumes the previous is complete and working.

1. **Repo scaffold** — `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.gitignore`, `.env.example`
2. **Database schema** — Write `src/db/schema.ts` with all three tables, configure `drizzle.config.ts`, run `drizzle-kit generate` and `drizzle-kit migrate`
3. **Database client** — `src/db/index.ts` — initialize better-sqlite3 + Drizzle, verify connection
4. **Shared types** — `src/lib/types/index.ts` — TypeScript interfaces for all entities
5. **Next.js shell** — Root layout, globals.css, sidebar nav, login page + `/api/auth` route, middleware protection
6. **Search Profiles API** — GET, POST, PATCH, DELETE endpoints + Zod validation
7. **Profiles dashboard page** — List + form, connect to API
8. **Playwright browser setup** — `src/scraper/browser.ts` — singleton browser, persistent context
9. **FB session management** — `src/scraper/session.ts` + `scripts/fb-login.ts` — login flow, cookie save/load
10. **FB Marketplace scraper** — `src/scraper/marketplace.ts` — URL construction per profile, listing card extraction
11. **Scraper orchestrator** — `src/scraper/index.ts` — loads active profiles, runs marketplace scraper, deduplicates, inserts new listings
12. **node-cron job** — `src/jobs/scrape.ts` + `src/jobs/index.ts` — scheduled execution of scraper
13. **Worker entry point** — `worker.ts` — starts jobs
14. **pm2 config** — `pm2.config.js` — web and worker processes
15. **Status endpoint** — `/api/status` reads `data/status.json`, shows in sidebar
16. **Telegram bot** — `src/bot/index.ts`, auth middleware, `/start`, `/help`
17. **Telegram formatters** — `src/lib/telegram/formatters.ts` + `keyboards.ts`
18. **Telegram alert sending** — Connect scraper job to bot: send alert after inserting new listing
19. **Telegram status commands** — `/interested`, `/reject`, `/contact` — PATCH listing status via DB
20. **Listings API** — GET (with filters/pagination), GET by ID, PATCH status
21. **Listings dashboard page** — Table with filters, status dropdown, pagination
22. **Listing detail page** — Two-panel layout, status selector, Carfax URL input
23. **Carfax parser** — `src/lib/carfax/parser.ts` — Playwright DOM extraction from carfax.shop
24. **Carfax verdict logic** — `src/lib/carfax/verdict.ts` — scoring function
25. **Carfax API** — POST (triggers parse), GET list, GET by ID
26. **Carfax from dashboard** — Wire up detail page URL input → API → result display
27. **Telegram carfax command** — `/carfax` handler → API → formatted response
28. **Carfax history page** — Table, expandable rows, verdict filter
29. **Deploy script** — `scripts/deploy.sh`
30. **Docs** — `docs/setup.md`, `docs/scraper.md`, `docs/carfax.md`

---

## Success Metrics

Post-launch, measure:

| Metric | Target | How to Measure |
|---|---|---|
| Alert latency | New listing → Telegram alert within 5 minutes | Log `alerted_at` vs `created_at` on listings |
| Duplicate rate | Zero re-alerts on seen listings | Check `fb_listing_id` uniqueness violations |
| False positive rate | < 10% of alerted listings immediately rejected | `rejected` listings / total `alerted_at` listings |
| Carfax parse success rate | > 90% of submitted URLs return non-unknown verdict | `verdict != 'unknown'` count / total reports |
| Scraper uptime | Runs at least once per 15 minutes (3x interval) | `data/status.json` last run time |
| Deal found | 1 car purchased through the tool | Manual — this is the ultimate success metric |
