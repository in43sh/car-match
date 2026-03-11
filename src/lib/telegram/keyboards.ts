import { InlineKeyboard } from 'grammy'

/** Quick-action keyboard attached to every new listing alert. */
export function listingKeyboard(listingId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Interested', `interested:${listingId}`)
    .text('❌ Reject',     `reject:${listingId}`)
    .text('📞 Contact',   `contact:${listingId}`)
}
