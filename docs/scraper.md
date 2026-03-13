# Scraper Maintenance Guide

## FB Marketplace DOM Selector Map

Confirmed from inspection on 2026-03-11. All selectors are pattern-based — **never use class names**, which are obfuscated and change without notice.

### Card Extraction

| Field | Selector / Strategy | Example Output |
|---|---|---|
| Card root | `a[href*="/marketplace/item/"]` | one per listing |
| Listing ID | regex `/item\/(\d+)/` on `href` | `"888997753767201"` |
| Full URL | `"https://www.facebook.com" + pathname(href)` | `https://www.facebook.com/marketplace/item/888997753767201/` |
| Image src | `img` (first inside card), `.src` | CDN URL |
| Title | `img[alt]` split on `" in "` → left part | `"2018 Toyota rav4 LE Sport Utility 4D"` |
| Location | `img[alt]` split on `" in "` → right part | `"Orlando, FL"` |
| Year | regex `/^(19\|20)\d{2}/` from title | `2018` |
| Price | `span[dir="auto"]` text matching `/^\$[\d,]+$/` | `"$13,899"` → `13899` |
| Mileage | `span[dir="auto"]` text matching `/[\d.,]+K?\s*miles?/i` | `"95K miles"` → `95000` |
| Seller type | Not in card DOM | `null` — requires detail page load |

### The `img[alt]` Pattern

The image alt attribute is the most stable extraction source. FB sets it as:
```
"{year} {make} {model} {trim} in {city}, {state}"
```

Examples:
- `"2018 Toyota rav4 LE Sport Utility 4D in Orlando, FL"`
- `"2020 Honda Civic EX Sedan in Tampa, FL"`

Split on `" in "` (with spaces) to get title and location. If the alt text is missing or doesn't match this pattern, fall back to `span[dir="auto"]` text nodes.

### Price Parsing

```
"$13,899"  → 13899
"$8,500"   → 8500
"Free"     → null (filter out — not a car listing)
"Price not listed" → null
```

### Mileage Parsing

```
"95K miles"    → 95000
"67,000 miles" → 67000
"1,234 miles"  → 1234
"150K miles"   → 150000
"12.5K miles"  → 12500
```

---

## When Selectors Break

### Symptoms
- `a[href*="/marketplace/item/"]` returns 0 results
- Script finds cards but all text nodes are empty
- Image alt text format changed

### Diagnosis Steps

1. Run the inspector script:
   ```bash
   npx tsx scripts/inspect-marketplace-dom.ts
   ```
2. Check `scripts/marketplace-snapshot.png` — is the page showing listings or a login/CAPTCHA wall?
3. If it's a login wall → FB session expired. See **Session Refresh** below.
4. If listings are visible but selectors fail → open `scripts/first-card.html` in browser, inspect the updated DOM, update this guide.

### Updating Selectors

1. Inspect `scripts/first-card.html` in Chrome DevTools
2. Find the new stable anchor point (prefer `data-*` or `aria-*` attrs, then text patterns)
3. Update extraction logic in `src/scraper/marketplace.ts`
4. Test: `npx tsx scripts/inspect-marketplace-dom.ts` — confirm fields appear in output
5. Update this file with the new selector map and date

---

## Session Refresh (when FB blocks the scraper)

### Symptoms
- Scraper navigates to search but gets login page or CAPTCHA
- `data/status.json` shows repeated errors
- Telegram alerts stop

### Steps

1. On your **Mac** (headed browser required):
   ```bash
   cd /Users/sergey/webdev/car-match
   npm run fb:login          # log in manually in the browser window
   ```

2. Copy the session to the server:
   ```bash
   scp data/fb-session.json root@167.71.84.246:/root/car-match/data/fb-session.json
   ```

3. Restart the worker:
   ```bash
   ssh root@167.71.84.246 "source ~/.nvm/nvm.sh && pm2 restart worker"
   ```

4. Check the next scrape cycle completed successfully:
   ```bash
   ssh root@167.71.84.246 "pm2 logs worker --lines 50"
   ssh root@167.71.84.246 "cat /root/car-match/data/status.json"
   ```

### Prevention

- Use a dedicated Facebook account (not your personal one)
- Keep scrape interval ≥ 5 minutes
- Random delays between profile scrapes (5–10 seconds)
- Reuse the browser context across cycles (avoid repeated logins)

---

## Quiet Hours

Each search profile can have a quiet window (`quietFrom` / `quietUntil`, stored as UTC hours 0–23). When the scraper cycle runs, any profile whose quiet window is currently active is **skipped entirely** — no scrape, no Telegram alerts for that profile until the window ends.

The window supports overnight ranges (e.g. `from=22, until=6` covers 22:00–06:00). If either value is `null`, quiet hours are disabled for that profile.

Configure per profile in the dashboard under **Profiles → Edit**.

---

## Rate Limiting Tuning

Current defaults in `src/scraper/browser.ts`:

| Setting | Default | Notes |
|---|---|---|
| Scrape interval | `SCRAPE_INTERVAL_MINUTES` (env) | Min 3, default 5 |
| Post-load wait | 2,000ms | After `waitForSelector` |
| Between profiles | 5,000–10,000ms random | Prevents burst scraping |
| Between page loads | 2,000–8,000ms random | Within a single profile |

If you're getting blocked frequently:
- Increase `SCRAPE_INTERVAL_MINUTES` to 10+
- Increase between-profile delay to 15–30 seconds
- Consider scraping only during business hours (FB may flag off-hours bot activity less)
