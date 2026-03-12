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
import { createBot, sendListingAlert, sendSystemAlert } from './bot'

console.log('[worker] Starting CarMatch worker…')
console.log(`[worker] Node ${process.version} — ${new Date().toISOString()}`)

// ─── Telegram bot ─────────────────────────────────────────────────────────────

const bot = createBot()
bot.start({ drop_pending_updates: true }).catch((err) => {
  console.error('[worker] Bot crashed:', err)
  process.exit(1)
})
console.log('[bot] Polling started')

const sendAlert = (msg: string) => sendSystemAlert(bot, msg)

// Notify on startup — if PM2 restarted the process after a crash, you'll see this
sendAlert('🟢 <b>CarMatch worker started</b>')
  .catch(err => console.error('[worker] Failed to send startup alert:', err))

// ─── Cron jobs ────────────────────────────────────────────────────────────────

startJobs(
  (listing) => sendListingAlert(bot, listing),
  sendAlert,
)

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
