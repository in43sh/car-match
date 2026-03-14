# Carfax Dealership Analysis — Feature Idea

## Concept

Given a set of filters (make, model, year, price, odometer) and a location:
1. Find all dealerships nearby that share Carfax reports
2. Scrape their inventory and extract Carfax links
3. Analyze the Carfax reports for filtered cars
4. Surface good deals across all dealerships

## Core Technical Challenges

### 1. Finding dealerships with Carfax
No public directory exists. Would need to:
- Use Google Places API to find dealerships near a location
- Crawl each dealership's website to check if they expose Carfax links
- Every dealership site has a different structure

### 2. Carfax links are one-time/encoded
The Carfax link on a listing (e.g. `https://www.carfax.com/vehiclehistory/ar20/xjlk-...`) is a signed token generated per-listing. You cannot construct it from a VIN — you have to find it on the dealership's inventory page.

### 3. No public Carfax API
Scraping carfax.com directly would likely violate their ToS and they have bot protection. Any solution depends on parsing their HTML, which can break anytime.

### 4. Scale
"All dealerships near me" could mean dozens of sites, each needing custom scraping logic or a headless browser session.

## Architecture Decision: New App vs Integrate into car-match

### Integrate into car-match if:
- You want one place for all car-hunting (FB private sellers + dealerships)
- You want Telegram notifications for deals found
- You want to reuse existing infrastructure (server, PM2, DB, bot)

### Separate app if:
- This is more of a one-off research tool run manually
- You want to keep car-match focused on FB Marketplace scraping
- Dealership scraping complexity would bloat the current codebase

## Recommended Approach

**Start as a standalone script**, not a full app.

1. Pick 3–5 specific dealership sites you know share Carfax
2. Write targeted scrapers for those sites
3. Validate the concept and usefulness
4. If proven valuable, integrate into car-match

The dealership-crawling piece is the hard part and warrants a proof-of-concept before committing to an architecture.

## Example Reference

- Test dealership: https://www.gaaautosales.com/inventory/nissan/sentra/2665/
- Carfax link format: `https://www.carfax.com/vehiclehistory/ar20/<encoded-token>`
