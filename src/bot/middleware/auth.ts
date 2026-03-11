import type { Context, NextFunction } from 'grammy'

/**
 * grammY middleware — silently drops all messages from users other than
 * the configured owner. No error response is sent (avoids confirming the
 * bot exists to unknown callers).
 */
export async function ownerOnly(ctx: Context, next: NextFunction): Promise<void> {
  const allowedId = Number(process.env.TELEGRAM_ALLOWED_USER_ID)
  if (!allowedId || ctx.from?.id !== allowedId) return
  await next()
}
