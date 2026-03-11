/**
 * carfax.shop DOM Inspector
 *
 * One-off script to map the DOM structure of a carfax.shop report page.
 * No login required — just pass a report URL as the first argument.
 *
 * Usage:
 *   npx tsx scripts/inspect-carfax-dom.ts "https://api.carfax.shop/report/view?hash=..."
 *
 * Output:
 *   - Prints extracted field values and their selectors to stdout
 *   - Saves scripts/carfax-snapshot.png (screenshot after JS renders)
 *   - Saves scripts/carfax-snapshot.html (full page HTML for offline inspection)
 *   - Saves scripts/carfax-first-section.html (inner HTML of #summary-section)
 *
 * After running, copy confirmed selectors into docs/carfax.md.
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join } from 'path'

const url = process.argv[2]
if (!url) {
  console.error('Usage: npx tsx scripts/inspect-carfax-dom.ts "<url>"')
  process.exit(1)
}

// Known candidate selectors from CSS inspection — probe all of them
const CANDIDATE_SELECTORS = [
  '#summary-section',
  '#history-overview',
  '#vehicle-information-panel',
  '.history-overview-row',
  '.history-overview-text-cell',
  '.ownership-history-section',
  '.title-history-section',
  '.common-section-cell-content',
  '.common-section-cell-alert',
  '.detailed-history-records',
  '.record-odometer-reading',
  '.accident-leadership-message',
  '.vehicle-information',
]

async function main() {
  console.log('\n🔍 carfax.shop DOM Inspector')
  console.log(`   URL: ${url}\n`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  // ── Load page ──────────────────────────────────────────────────────────────
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // The page makes an async fetch after load — wait for either report content or error message
  const rendered = await Promise.race([
    page.waitForSelector('#summary-section',            { timeout: 20_000 }).then(() => '#summary-section'),
    page.waitForSelector('#history-overview',           { timeout: 20_000 }).then(() => '#history-overview'),
    page.waitForSelector('.history-overview-row',       { timeout: 20_000 }).then(() => '.history-overview-row'),
    page.waitForSelector('.ownership-history-section',  { timeout: 20_000 }).then(() => '.ownership-history-section'),
    // Also detect the error state so we can report it clearly
    page.waitForFunction(
      () => document.body.innerText.includes('Failed to load') || document.body.innerText.includes('завантажити'),
      { timeout: 20_000 }
    ).then(() => 'ERROR: report failed to load — hash may be expired'),
  ]).catch(() => null)

  if (!rendered) {
    console.log('⚠️  Timed out waiting for page content. Check carfax-snapshot.png.\n')
  } else if (String(rendered).startsWith('ERROR')) {
    console.log(`\n❌ ${rendered}`)
    console.log('   Get a fresh carfax.shop URL and re-run the script.\n')
    await page.screenshot({ path: join(process.cwd(), 'scripts', 'carfax-snapshot.png'), fullPage: true })
    await browser.close()
    return
  } else {
    console.log(`✅ Page rendered — triggered by: ${rendered}`)
  }

  await page.waitForTimeout(3_000)

  // ── Save artifacts ─────────────────────────────────────────────────────────
  const screenshotPath = join(process.cwd(), 'scripts', 'carfax-snapshot.png')
  const htmlPath = join(process.cwd(), 'scripts', 'carfax-snapshot.html')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  writeFileSync(htmlPath, await page.content())
  console.log(`\n📸 Screenshot → ${screenshotPath}`)
  console.log(`📄 HTML       → ${htmlPath}`)

  // Save #summary-section inner HTML if it exists
  const summaryHtml = await page.$eval('#summary-section', el => el.innerHTML).catch(() => null)
  if (summaryHtml) {
    const summaryPath = join(process.cwd(), 'scripts', 'carfax-summary-section.html')
    writeFileSync(summaryPath, summaryHtml)
    console.log(`📄 Summary    → ${summaryPath}`)
  }

  // ── Probe candidate selectors ──────────────────────────────────────────────
  console.log('\n─── Selector Probe ───────────────────────────────────────────')
  for (const sel of CANDIDATE_SELECTORS) {
    const count = await page.$$eval(sel, els => els.length).catch(() => 0)
    const text = count > 0
      ? await page.$eval(sel, el => (el as HTMLElement).innerText?.slice(0, 120).replace(/\n/g, ' | ')).catch(() => '')
      : ''
    console.log(`  ${count > 0 ? '✅' : '❌'} ${sel.padEnd(40)} ${count} found  ${text ? `"${text}"` : ''}`)
  }

  // ── Extract target fields ──────────────────────────────────────────────────
  console.log('\n─── Target Field Extraction ──────────────────────────────────')

  // All visible text from the page, deduped
  const allText = await page.$$eval('*', els =>
    [...new Set(
      els
        .map(el => (el as HTMLElement).innerText?.trim())
        .filter(t => t && t.length > 2 && t.length < 200 && !t.includes('{'))
    )]
  ).catch(() => [] as string[])

  // Accident-related lines
  const accidentLines = allText.filter(t =>
    /accident|collision|damage/i.test(t)
  )
  console.log('\n  💥 Accident-related text:')
  accidentLines.slice(0, 8).forEach(l => console.log(`     "${l}"`))

  // Owner-related lines
  const ownerLines = allText.filter(t =>
    /owner|owner[s]?|previous/i.test(t)
  )
  console.log('\n  👤 Owner-related text:')
  ownerLines.slice(0, 8).forEach(l => console.log(`     "${l}"`))

  // Title-related lines
  const titleLines = allText.filter(t =>
    /title|salvage|rebuilt|lemon|branded|clean/i.test(t)
  )
  console.log('\n  📜 Title-related text:')
  titleLines.slice(0, 8).forEach(l => console.log(`     "${l}"`))

  // Odometer-related lines
  const odometerLines = allText.filter(t =>
    /odometer|rollback|mileage|miles|reading/i.test(t)
  )
  console.log('\n  🔄 Odometer-related text:')
  odometerLines.slice(0, 8).forEach(l => console.log(`     "${l}"`))

  // ── Full text dump of #summary-section ────────────────────────────────────
  const summaryText = await page.$eval(
    '#summary-section',
    el => (el as HTMLElement).innerText
  ).catch(() => null)

  if (summaryText) {
    console.log('\n─── #summary-section Full Text ───────────────────────────────')
    console.log(summaryText.slice(0, 1000))
  }

  // ── History overview rows ──────────────────────────────────────────────────
  const overviewRows = await page.$$eval('.history-overview-row', rows =>
    rows.map(row => (row as HTMLElement).innerText?.trim().replace(/\n/g, ' | '))
  ).catch(() => [] as string[])

  if (overviewRows.length > 0) {
    console.log('\n─── .history-overview-row items ──────────────────────────────')
    overviewRows.forEach((r, i) => console.log(`  [${i}] "${r}"`))
  }

  // ── Ownership table ────────────────────────────────────────────────────────
  const ownershipText = await page.$eval(
    '.ownership-history-section',
    el => (el as HTMLElement).innerText
  ).catch(() => null)
  if (ownershipText) {
    console.log('\n─── .ownership-history-section ───────────────────────────────')
    console.log(ownershipText.slice(0, 500))
  }

  // ── Title table ───────────────────────────────────────────────────────────
  const titleText = await page.$eval(
    '.title-history-section',
    el => (el as HTMLElement).innerText
  ).catch(() => null)
  if (titleText) {
    console.log('\n─── .title-history-section ───────────────────────────────────')
    console.log(titleText.slice(0, 500))
  }

  // ── Alert cells (red = issue) ──────────────────────────────────────────────
  const alertCells = await page.$$eval('.common-section-cell-alert', els =>
    els.map(el => (el as HTMLElement).innerText?.trim())
  ).catch(() => [] as string[])
  if (alertCells.length > 0) {
    console.log('\n─── .common-section-cell-alert (issue flags) ─────────────────')
    alertCells.forEach(t => console.log(`  ⚠️  "${t}"`))
  }

  console.log('\n─── Next Steps ───────────────────────────────────────────────')
  console.log('  1. Review output above to confirm which selectors matched')
  console.log('  2. Open scripts/carfax-summary-section.html in browser for detail')
  console.log('  3. Record confirmed selectors in docs/carfax.md')
  console.log('  4. Implement src/lib/carfax/parser.ts based on findings\n')

  await browser.close()
}

main().catch(err => {
  console.error('\n❌ Script failed:', err.message)
  process.exit(1)
})
