import type { CommandContext, Context } from 'grammy'
import { db } from '@/db'
import { searchProfiles } from '@/db/schema'
import { eq, ne } from 'drizzle-orm'

export async function handlePauseAll(ctx: CommandContext<Context>) {
  const active = db.select().from(searchProfiles).where(eq(searchProfiles.isActive, true)).all()

  if (active.length === 0) {
    await ctx.reply('⚪ All scrapers are already paused.')
    return
  }

  db.update(searchProfiles).set({ isActive: false }).where(ne(searchProfiles.isActive, false)).run()

  const names = active.map(p => `• ${p.name}`).join('\n')
  await ctx.reply(`⏸ Paused ${active.length} scraper(s):\n${names}`)
}

export async function handleResumeAll(ctx: CommandContext<Context>) {
  const paused = db.select().from(searchProfiles).where(eq(searchProfiles.isActive, false)).all()

  if (paused.length === 0) {
    await ctx.reply('🟢 All scrapers are already running.')
    return
  }

  db.update(searchProfiles).set({ isActive: true }).where(eq(searchProfiles.isActive, false)).run()

  const names = paused.map(p => `• ${p.name}`).join('\n')
  await ctx.reply(`▶️ Resumed ${paused.length} scraper(s):\n${names}`)
}
