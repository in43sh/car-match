# GAA Auto Sales Dealership Scraper — Prompt

Write a Node.js/TypeScript scraper for `https://www.gaaautosales.com/` that integrates with the existing CarMatch codebase.

**Goal:** Periodically fetch all vehicle listings from GAA Auto Sales and insert new ones into the existing `listings` table using the same dedup and alert pipeline already used for Facebook Marketplace.

**Tech stack:** Use Playwright (already in the project) with a headless Chromium browser, since the site returns 403 to plain HTTP requests.

**Data to extract per listing:**
- Year, make, model (from title)
- Price
- Mileage
- VIN or stock number (if available)
- Image URL
- Listing URL (dealer page URL, used as the unique dedup key instead of `fbListingId`)

**Integration:**
- Reuse `src/scraper/browser.ts` for the Playwright singleton (no FB session needed — just a plain browser context)
- Save listings to the same `listings` table with `sellerType = 'dealer'`
- Use the listing's full URL as the unique identifier (map to `fbListingId` field, or add a `sourceUrl` field if preferred)
- Plug into the existing dedup logic (skip if already seen, otherwise insert + trigger Telegram alert)

**Unknowns to verify before coding (inspect the site in DevTools):**
- Inventory page URL (e.g. `/inventory`, `/vehicles`, `/used-cars`)
- CSS selectors or JSON data for listing cards
- Whether listings are server-rendered HTML or loaded via a JSON API call
- Pagination mechanism (page number in URL, infinite scroll, load-more button)
