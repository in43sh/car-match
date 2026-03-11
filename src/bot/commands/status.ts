import type { CommandContext, Context, Filter } from 'grammy'
import { db } from '@/db'
import { listings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { ListingStatus } from '@/lib/types'

const STATUS_LABELS: Record<ListingStatus, string> = {
  new:        'New',
  interested: 'Interested',
  rejected:   'Rejected',
  contacted:  'Contacted',
}

async function setStatus(id: number, status: ListingStatus): Promise<boolean> {
  const now = new Date().toISOString()
  const [updated] = db
    .update(listings)
    .set({ status, updatedAt: now })
    .where(eq(listings.id, id))
    .returning()
    .all()
  return Boolean(updated)
}

function parseId(text: string | undefined): number | null {
  if (!text) return null
  const n = parseInt(text.trim(), 10)
  return isNaN(n) ? null : n
}

// ─── Text commands (/interested 42, /reject 42, /contact 42) ─────────────────

async function handleStatusCommand(
  ctx: CommandContext<Context>,
  status: ListingStatus,
) {
  const id = parseId(ctx.match as string)
  if (!id) {
    await ctx.reply(`Usage: /${status} <listing_id>`)
    return
  }

  const ok = await setStatus(id, status)
  if (!ok) {
    await ctx.reply(`Listing #${id} not found.`)
    return
  }

  await ctx.reply(`Listing #${id} marked as <b>${STATUS_LABELS[status]}</b>.`, { parse_mode: 'HTML' })
}

export const handleInterested = (ctx: CommandContext<Context>) => handleStatusCommand(ctx, 'interested')
export const handleReject      = (ctx: CommandContext<Context>) => handleStatusCommand(ctx, 'rejected')
export const handleContact     = (ctx: CommandContext<Context>) => handleStatusCommand(ctx, 'contacted')

// ─── Inline keyboard callbacks (interested:42, reject:42, contact:42) ─────────

export async function handleCallbackStatus(ctx: Filter<Context, 'callback_query:data'>) {
  const data   = ctx.callbackQuery.data     // e.g. "interested:42"
  const [action, idStr] = data.split(':')
  const id = parseInt(idStr, 10)

  const statusMap: Record<string, ListingStatus> = {
    interested: 'interested',
    reject:     'rejected',
    contact:    'contacted',
  }

  const status = statusMap[action]
  if (!status || isNaN(id)) {
    await ctx.answerCallbackQuery({ text: 'Unknown action' })
    return
  }

  const ok = await setStatus(id, status)
  await ctx.answerCallbackQuery({
    text: ok ? `Marked as ${STATUS_LABELS[status]}` : 'Listing not found',
  })

  if (ok) {
    // Update the message to show the new status (replace keyboard with plain text)
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined })
    } catch { /* message may be too old to edit */ }
  }
}
