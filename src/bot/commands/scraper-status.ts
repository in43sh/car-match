import type { CommandContext, Context } from 'grammy'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import type { StatusFile } from '@/lib/types'

const STATUS_PATH = path.resolve(process.cwd(), './data/status.json')

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

function timeUntil(iso: string): string {
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000)
  if (secs <= 0)   return 'any moment'
  if (secs < 60)   return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  return `${Math.floor(secs / 3600)}h`
}

export async function handleScraperStatus(ctx: CommandContext<Context>) {
  if (!existsSync(STATUS_PATH)) {
    await ctx.reply('⚪ Scraper has not run yet — no status file found.')
    return
  }

  let file: StatusFile
  try {
    file = JSON.parse(readFileSync(STATUS_PATH, 'utf-8')) as StatusFile
  } catch {
    await ctx.reply('❓ Could not read status file.')
    return
  }

  const icon  = file.status === 'active' ? '🟢' : file.status === 'error' ? '🔴' : '⚪'
  const label = file.status === 'active' ? 'Active' : file.status === 'error' ? 'Error' : 'Idle'

  let msg = `${icon} <b>Scraper: ${label}</b>\n\n`
  msg += `Last run: ${timeAgo(file.lastRunAt)}\n`
  msg += `Next run: in ${timeUntil(file.nextRunAt)}\n`
  msg += `Active profiles: ${file.activeProfiles}`

  if (file.status === 'error' && file.lastError) {
    msg += `\n\n⚠️ <i>${file.lastError}</i>`
  }

  await ctx.reply(msg, { parse_mode: 'HTML' })
}
