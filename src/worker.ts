/**
 * Worker process entry point.
 *
 * Started by pm2 as a separate process alongside the Next.js web server.
 * Runs the scrape cron job and handles graceful shutdown.
 *
 * Start manually:  npm run worker
 * Start via pm2:   pm2 start pm2.config.js
 */

import 'dotenv/config'
import { startJobs } from './jobs'
import { closeBrowser } from './scraper/browser'
import { createBot, sendListingAlert } from './bot'

console.log('[worker] Starting CarMatch worker…')
console.log(`[worker] Node ${process.version} — ${new Date().toISOString()}`)

// ─── Telegram bot ─────────────────────────────────────────────────────────────

const bot = createBot()
bot.start({ drop_pending_updates: true }).catch((err) => {
  console.error('[worker] Bot crashed:', err)
  process.exit(1)
})
console.log('[bot] Polling started')

// ─── Cron jobs ────────────────────────────────────────────────────────────────

startJobs((listing) => sendListingAlert(bot, listing))

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`\n[worker] ${signal} received — shutting down…`)
  await bot.stop()
  await closeBrowser()
  console.log('[worker] Clean exit')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
