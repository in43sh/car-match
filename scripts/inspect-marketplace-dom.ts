/**
 * FB Marketplace DOM Inspector
 *
 * One-off script to map the DOM structure of a search results page.
 * Run this while logged in to Facebook to capture selectors for marketplace.ts.
 *
 * Prerequisites (run once):
 *   npm init -y
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Usage:
 *   npx tsx scripts/inspect-marketplace-dom.ts
 *
 * Output:
 *   - Prints a selector map to stdout
 *   - Saves a screenshot to scripts/marketplace-snapshot.png
 *   - Saves full page HTML to scripts/marketplace-snapshot.html (for offline inspection)
 *
 * After running, copy the confirmed selectors into docs/scraper.md.
 */

import { chromium, type Page } from 'playwright'
import { writeFileSync } from 'fs'
import { join } from 'path'

// ─── Config ──────────────────────────────────────────────────────────────────

// Change this to a real search you want to inspect
const SEARCH_URL =
  'https://www.facebook.com/marketplace/tampa/vehicles/' +
  '?maxMileage=100000&maxYear=2020&make=2318041991806363&exact=false'

// Path to a saved FB session (cookies). If it doesn't exist, the script
// will open the browser so you can log in manually.
const SESSION_PATH = join(process.cwd(), 'data', 'fb-session.json')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trySelector(label: string, selector: string, value: string | null) {
  const found = value !== null
  console.log(`  ${found ? '✅' : '❌'} ${label}`)
  if (found) console.log(`     selector : ${selector}`)
  if (found) console.log(`     sample   : ${String(value).slice(0, 120)}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 FB Marketplace DOM Inspector\n')

  // Try to load saved session, otherwise start fresh (will need manual login)
  let storageState: string | undefined
  try {
    require('fs').accessSync(SESSION_PATH)
    storageState = SESSION_PATH
    console.log('📂 Loaded FB session from', SESSION_PATH)
  } catch {
    console.log('⚠️  No saved session found at', SESSION_PATH)
    console.log('   Browser will open — log in manually, then the script continues.\n')
  }

  const browser = await chromium.launch({ headless: storageState !== undefined })
  const context = await browser.newContext({
    storageState,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  })

  const page: Page = await context.newPage()

  if (!storageState) {
    // Let user log in manually
    await page.goto('https://www.facebook.com/login')
    console.log('⏳ Waiting for manual login (you have 60 seconds)...')
    // Wait until URL is no longer the login page (FB may redirect to feed or elsewhere)
    await page.waitForFunction(
      () => !window.location.href.includes('/login'),
      { timeout: 60_000 }
    )
    console.log('✅ Logged in. Saving session...')
    require('fs').mkdirSync(require('path').dirname(SESSION_PATH), { recursive: true })
    await context.storageState({ path: SESSION_PATH })
  }

  // ── Navigate to search ─────────────────────────────────────────────────────
  console.log('\n📡 Loading search URL...')
  await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Wait for at least one listing link — FB renders cards via React after load
  try {
    await page.waitForSelector('a[href*="/marketplace/item/"]', { timeout: 15_000 })
  } catch {
    console.log('⚠️  Listing links not found within 15s — proceeding anyway')
  }

  // Extra settling time for lazy images and text
  await page.waitForTimeout(2_000)

  // Dismiss any login/cookie popups
  for (const closeSelector of [
    '[aria-label="Close"]',
    '[data-testid="cookie-policy-manage-dialog-accept-button"]',
  ]) {
    try {
      const btn = page.locator(closeSelector).first()
      if (await btn.isVisible({ timeout: 1_500 })) await btn.click()
    } catch { /* ignore */ }
  }

  await page.waitForTimeout(1_500)

  // ── Save artifacts ─────────────────────────────────────────────────────────
  const screenshotPath = join(process.cwd(), 'scripts', 'marketplace-snapshot.png')
  const htmlPath = join(process.cwd(), 'scripts', 'marketplace-snapshot.html')
  await page.screenshot({ path: screenshotPath, fullPage: false })
  writeFileSync(htmlPath, await page.content())
  console.log(`\n📸 Screenshot saved → ${screenshotPath}`)
  console.log(`📄 HTML saved       → ${htmlPath}\n`)

  // ── Probe for listing cards ────────────────────────────────────────────────
  console.log('─── Listing Card Container ───────────────────────────────────')

  // Strategy 1: data-testid
  const testidCards = await page.$$('[data-testid="marketplace_pdp_component"]')
  console.log(`  data-testid="marketplace_pdp_component": ${testidCards.length} found`)

  // Strategy 2: anchor links to /marketplace/item/
  const itemLinks = await page.$$('a[href*="/marketplace/item/"]')
  console.log(`  a[href*="/marketplace/item/"]: ${itemLinks.length} found`)

  // Strategy 3: aria-label containing common listing words
  const ariaCards = await page.$$('[aria-label]')
  const listingAriaCards = []
  for (const el of ariaCards.slice(0, 50)) {
    const label = await el.getAttribute('aria-label')
    if (label && /\$|mile|year/i.test(label)) listingAriaCards.push(label)
  }
  console.log(`  aria-label containing price/miles: ${listingAriaCards.length} found`)
  if (listingAriaCards.length > 0) {
    console.log('  Sample aria-labels:')
    listingAriaCards.slice(0, 3).forEach(l => console.log(`    "${l}"`))
  }

  // ── Inspect first card in detail ───────────────────────────────────────────
  const firstCard = itemLinks[0] ?? testidCards[0]

  if (!firstCard) {
    console.log('\n❌ No listing cards found. Possible causes:')
    console.log('   - Not logged in / session expired')
    console.log('   - FB showed a CAPTCHA or rate-limit page')
    console.log('   - Search returned zero results')
    console.log('   Check scripts/marketplace-snapshot.png to see what loaded.\n')
    await browser.close()
    return
  }

  console.log('\n─── First Card Detail ────────────────────────────────────────')

  // Listing URL + ID
  const href = await firstCard.getAttribute('href')
  const listingIdMatch = href?.match(/\/item\/(\d+)/)
  trySelector('Listing URL (href)', 'a[href*="/marketplace/item/"]', href ?? null)
  trySelector('Listing ID (from href)', 'regex /item/(\\d+)/', listingIdMatch?.[1] ?? null)

  // Get the card's outer HTML for manual inspection
  const cardHTML = await firstCard.evaluate(el => el.outerHTML)
  const cardHTMLPath = join(process.cwd(), 'scripts', 'first-card.html')
  writeFileSync(cardHTMLPath, cardHTML)
  console.log(`\n📄 First card HTML  → ${cardHTMLPath}`)

  // Try to extract fields from within the card
  const card = firstCard
  const cardText = await card.evaluate(el => el.innerText)
  console.log('\n─── Card Inner Text (raw) ────────────────────────────────────')
  console.log(cardText.slice(0, 400))

  // Image
  const img = await card.$('img')
  const imgSrc = img ? await img.getAttribute('src') : null
  trySelector('Image src', 'a[href*="/marketplace/item/"] img', imgSrc)

  // Structured text extraction
  console.log('\n─── Text Node Structure ──────────────────────────────────────')
  const allSpans = await card.$$eval('span, div[dir="auto"]', els =>
    els.map(el => ({
      tag: el.tagName.toLowerCase(),
      text: (el as HTMLElement).innerText?.trim(),
      classes: el.className,
    })).filter(n => n.text && n.text.length > 0 && n.text.length < 80)
  )

  console.log(`  Found ${allSpans.length} text nodes. First 20:`)
  allSpans.slice(0, 20).forEach((n, i) => {
    console.log(`  [${i}] <${n.tag}> "${n.text}"`)
  })

  // Try common price patterns
  console.log('\n─── Candidate Selectors (inferred) ──────────────────────────')

  const priceNode = allSpans.find(n => /^\$[\d,]+$/.test(n.text))
  const yearNode = allSpans.find(n => /^(19|20)\d{2}$/.test(n.text))
  const mileageNode = allSpans.find(n => /[\d,]+\s*(miles?|mi|K mi)/i.test(n.text))

  if (priceNode)   console.log(`  💰 Price     likely: "${priceNode.text}"`)
  if (yearNode)    console.log(`  📅 Year      likely: "${yearNode.text}"`)
  if (mileageNode) console.log(`  🛣️  Mileage   likely: "${mileageNode.text}"`)

  if (!priceNode && !yearNode && !mileageNode) {
    console.log('  ⚠️  Could not auto-detect price/year/mileage from text nodes.')
    console.log('  Open scripts/first-card.html in a browser to inspect manually.')
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n─── Next Steps ───────────────────────────────────────────────')
  console.log('  1. Open scripts/first-card.html in your browser')
  console.log('  2. Identify stable selectors for each field')
  console.log('  3. Prefer data-* / aria-* over class names')
  console.log('  4. Record confirmed selectors in docs/scraper.md')
  console.log('  5. Update src/scraper/marketplace.ts with those selectors\n')

  await browser.close()
}

main().catch(err => {
  console.error('\n❌ Script failed:', err.message)
  process.exit(1)
})
