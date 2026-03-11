import type { CommandContext, Context } from 'grammy'

export async function handleHelp(ctx: CommandContext<Context>) {
  await ctx.reply(
    '📋 <b>Commands</b>\n\n' +
    '/recent — 5 most recent New/Interested listings\n' +
    '/interested <i>id</i> — mark listing as Interested\n' +
    '/reject <i>id</i> — mark listing as Rejected\n' +
    '/contact <i>id</i> — mark listing as Contacted\n' +
    '/carfax <i>url</i> — parse a Carfax report\n' +
    '/carfax <i>id url</i> — parse and link to listing\n' +
    '/help — show this message',
    { parse_mode: 'HTML' },
  )
}
