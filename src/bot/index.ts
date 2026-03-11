import { Bot } from 'grammy'
import type { Context } from 'grammy'
import type { Listing } from '@/db/schema'
import { db } from '@/db'
import { searchProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ownerOnly } from './middleware/auth'
import { handleStart } from './commands/start'
import { handleHelp } from './commands/help'
import { handleRecent } from './commands/recent'
import {
  handleInterested,
  handleReject,
  handleContact,
  handleCallbackStatus,
} from './commands/status'
import { formatListingAlert } from '@/lib/telegram/formatters'
import { listingKeyboard } from '@/lib/telegram/keyboards'

// ─── Bot factory ──────────────────────────────────────────────────────────────

export function createBot(): Bot<Context> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')

  const bot = new Bot<Context>(token)

  // Auth gate — must be first
  bot.use(ownerOnly)

  // Commands
  bot.command('start',      handleStart)
  bot.command('help',       handleHelp)
  bot.command('recent',     handleRecent)
  bot.command('interested', handleInterested)
  bot.command('reject',     handleReject)
  bot.command('contact',    handleContact)

  // Inline keyboard callbacks (interested:42, reject:42, contact:42)
  bot.on('callback_query:data', handleCallbackStatus)

  return bot
}

// ─── Alert helper ─────────────────────────────────────────────────────────────

/**
 * Sends a Telegram alert for a newly discovered listing.
 * Resolves the profile name from DB, then sends an HTML message with the
 * quick-action inline keyboard.
 *
 * Used by the worker when wiring the alert callback:
 *   startJobs(sendListingAlert)
 */
export async function sendListingAlert(
  bot: Bot<Context>,
  listing: Listing,
): Promise<void> {
  const chatId = Number(process.env.TELEGRAM_ALLOWED_USER_ID)
  if (!chatId) {
    console.warn('[bot] TELEGRAM_ALLOWED_USER_ID not set — skipping alert')
    return
  }

  const profile = listing.profileId
    ? db.select().from(searchProfiles).where(eq(searchProfiles.id, listing.profileId)).get()
    : null

  const profileName = profile?.name ?? 'Unknown profile'
  const text        = formatListingAlert(listing, profileName)
  const keyboard    = listingKeyboard(listing.id)

  await bot.api.sendMessage(chatId, text, {
    parse_mode:   'HTML',
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  })
}
