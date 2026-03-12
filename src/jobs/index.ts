import { registerScrapeJob } from './scrape'
import type { Listing } from '@/db/schema'

/**
 * Registers all cron jobs and starts them.
 * Pass an optional alert callback — wired in Step 18 when the Telegram bot is ready.
 */
export function startJobs(
  onNewListing?: (listing: Listing) => Promise<void>,
  onError?: (message: string) => Promise<void>,
): void {
  registerScrapeJob(onNewListing, onError)
}
