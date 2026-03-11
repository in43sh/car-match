import cron from 'node-cron'
import { runScrapeCycle } from '@/scraper'

let running = false

export function registerScrapeJob(
  onNewListing?: Parameters<typeof runScrapeCycle>[0],
): void {
  const interval = parseInt(process.env.SCRAPE_INTERVAL_MINUTES ?? '5', 10)
  const safeInterval = Math.max(interval, 3) // floor at 3 minutes
  const expression = `*/${safeInterval} * * * *`

  console.log(`[jobs] Scrape job scheduled — every ${safeInterval} minutes (${expression})`)

  cron.schedule(expression, async () => {
    if (running) {
      console.log('[jobs] Previous scrape still running — skipping tick')
      return
    }
    running = true
    try {
      await runScrapeCycle(onNewListing)
    } catch (err) {
      console.error('[jobs] Unhandled scrape error:', err)
    } finally {
      running = false
    }
  })
}
