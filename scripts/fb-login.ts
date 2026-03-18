/**
 * FB Login — one-time interactive script.
 *
 * Opens a visible browser window on facebook.com/login.
 * You log in manually (including any 2FA). When the login is complete,
 * the script detects the redirect away from /login and saves the session
 * cookies to data/fb-session.json.
 *
 * Run once, then the scraper reuses the saved session.
 *
 * Usage:
 *   npx tsx scripts/fb-login.ts
 *
 * Re-run any time the session expires (typically every 30–90 days).
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const SESSION_PATH = path.resolve(
  process.cwd(),
  process.env.FB_SESSION_PATH ?? './data/fb-session.json',
)

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function main() {
  console.log('\n🔐 FB Login — CarMatch\n')
  console.log(`   Session will be saved to: ${SESSION_PATH}\n`)

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  })

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: null, // use the window size
  })

  const page = await context.newPage()

  console.log('   Opening Facebook login page…\n')
  await page.goto('https://www.facebook.com/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })

  console.log('   👉 Log in manually in the browser window.')
  console.log('   Complete any CAPTCHA or verification steps if prompted.')
  console.log('   Waiting for login to complete…\n')

  // Wait until the URL no longer contains /login, checkpoint, or captcha
  await page.waitForFunction(
    () =>
      !window.location.href.includes('/login') &&
      !window.location.href.includes('checkpoint') &&
      !window.location.href.includes('captcha') &&
      !window.location.href.includes('two_step') &&
      !window.location.href.includes('confirm'),
    { timeout: 15 * 60_000 }, // 15 minute timeout for manual login + CAPTCHA
  )

  console.log(`   ✅ Logged in (redirected to: ${page.url()})`)

  // Brief wait to let FB settle and set all session cookies
  await page.waitForTimeout(5_000)

  const cookies = await context.cookies()

  mkdirSync(path.dirname(SESSION_PATH), { recursive: true })
  writeFileSync(SESSION_PATH, JSON.stringify(cookies, null, 2), 'utf-8')

  console.log(`\n   💾 Saved ${cookies.length} cookies → ${SESSION_PATH}`)
  console.log('\n   You can close this window. The scraper will use the saved session.\n')

  await browser.close()
}

main().catch(err => {
  console.error('\n❌ Login script failed:', err.message)
  process.exit(1)
})
