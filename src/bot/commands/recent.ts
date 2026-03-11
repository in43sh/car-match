import type { CommandContext, Context } from 'grammy'
import { db } from '@/db'
import { listings } from '@/db/schema'
import { inArray, desc } from 'drizzle-orm'
import { formatRecentListing } from '@/lib/telegram/formatters'

export async function handleRecent(ctx: CommandContext<Context>) {
  const recent = db
    .select()
    .from(listings)
    .where(inArray(listings.status, ['new', 'interested']))
    .orderBy(desc(listings.createdAt))
    .limit(5)
    .all()

  if (recent.length === 0) {
    await ctx.reply('No new or interested listings right now.')
    return
  }

  const text = recent.map(formatRecentListing).join('\n\n')
  await ctx.reply(`<b>Recent Listings</b>\n\n${text}`, { parse_mode: 'HTML' })
}
