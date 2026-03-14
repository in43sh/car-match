import type { CommandContext, Context } from 'grammy'

export async function handleStart(ctx: CommandContext<Context>) {
  await ctx.reply(
    '👋 <b>CarMatch Bot</b>\n\n' +
    'I monitor Facebook Marketplace and dealership inventory pages for matching car listings.\n\n' +
    'Use /help to see all commands.',
    { parse_mode: 'HTML' },
  )
}
