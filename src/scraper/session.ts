/**
 * FB session utilities.
 *
 * Used by the scraper orchestrator at the start of each cycle to confirm
 * the session is still alive before attempting to scrape.
 */

import type { BrowserContext } from 'playwright'
import { saveSessionCookies } from './browser'

/**
 * Returns true if the context has a valid Facebook session.
 *
 * Uses the `c_user` cookie as the signal — FB sets it to the logged-in user ID.
 * No page navigation needed, so this is fast and doesn't consume a scrape request.
 *
 * Side-effect: if the session is valid, saves the latest cookies to disk
 * so any refreshed session tokens are persisted across restarts.
 */
export async function isSessionValid(context: BrowserContext): Promise<boolean> {
  try {
    const cookies = await context.cookies('https://www.facebook.com')
    const cUser   = cookies.find(c => c.name === 'c_user')
    const loggedIn = Boolean(cUser?.value)

    if (loggedIn) {
      await saveSessionCookies()
    }

    return loggedIn
  } catch {
    return false
  }
}
