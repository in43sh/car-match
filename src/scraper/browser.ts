/**
 * Playwright browser singleton.
 *
 * A single BrowserContext is created on first use and reused across all
 * scrape cycles. This keeps the FB session alive between runs without
 * re-logging in every cycle.
 *
 * Usage:
 *   const ctx  = await getBrowserContext()
 *   const page = await ctx.newPage()
 *   // ... scrape ...
 *   await page.close()  // close page, NOT the context
 *
 * Call closeBrowser() on worker shutdown for clean teardown.
 */

import { chromium, type Browser, type BrowserContext } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────

const SESSION_PATH = path.resolve(
  process.cwd(),
  process.env.FB_SESSION_PATH ?? './data/fb-session.json',
)

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ─── Singleton state ──────────────────────────────────────────────────────────

let browser:  Browser        | null = null
let context:  BrowserContext | null = null

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the shared BrowserContext, launching the browser and loading the
 * saved FB session cookies if this is the first call.
 */
export async function getBrowserContext(): Promise<BrowserContext> {
  if (context) return context

  browser = await chromium.launch({ headless: true })

  context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport:  { width: 1440, height: 900 },
    locale:    'en-US',
  })

  // Load saved FB session cookies if available
  const cookies = loadSessionCookies()
  if (cookies.length > 0) {
    await context.addCookies(cookies)
    console.log(`[browser] Loaded ${cookies.length} session cookies from ${SESSION_PATH}`)
  } else {
    console.log('[browser] No session cookies found — FB login required (run scripts/fb-login.ts)')
  }

  return context
}

/**
 * Saves the current session cookies back to disk so they persist across
 * worker restarts. Call this after a successful scrape cycle.
 */
export async function saveSessionCookies(): Promise<void> {
  if (!context) return
  try {
    const cookies = await context.cookies()
    writeFileSync(SESSION_PATH, JSON.stringify(cookies, null, 2), 'utf-8')
  } catch (err) {
    console.error('[browser] Failed to save session cookies:', err)
  }
}

/**
 * Closes the browser and clears the singleton. Call on worker shutdown.
 */
export async function closeBrowser(): Promise<void> {
  if (context) {
    await saveSessionCookies()
    await context.close()
    context = null
  }
  if (browser) {
    await browser.close()
    browser = null
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

type Cookie = Awaited<ReturnType<BrowserContext['cookies']>>[number]

function loadSessionCookies(): Cookie[] {
  if (!existsSync(SESSION_PATH)) return []
  try {
    const raw = readFileSync(SESSION_PATH, 'utf-8')
    return JSON.parse(raw) as Cookie[]
  } catch {
    console.warn('[browser] Session file exists but could not be parsed — ignoring')
    return []
  }
}
