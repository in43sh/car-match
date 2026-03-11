/**
 * Japanese brand allowlist with Facebook Marketplace numeric make IDs.
 *
 * IDs confirmed by inspecting FB Marketplace filter URLs (2026-03-11).
 * If a brand's listings stop appearing, verify the ID hasn't changed.
 */

export const JAPANESE_BRANDS: Record<string, string> = {
  toyota:   '2318041991806363',
  honda:    '308436969822020',
  mazda:    '410067716491465',
  nissan:   '2621742507840619',
  lexus:    '2101813456521413',
  infiniti: '1361484827327051',
  acura:    '280909549507187',
}

export type BrandKey = keyof typeof JAPANESE_BRANDS

export const BRAND_DISPLAY_NAMES: Record<string, string> = {
  toyota:   'Toyota',
  honda:    'Honda',
  mazda:    'Mazda',
  nissan:   'Nissan',
  lexus:    'Lexus',
  infiniti: 'Infiniti',
  acura:    'Acura',
}

/** Returns the FB numeric make ID for a brand key, or undefined if unknown. */
export function getMakeId(brandKey: string): string | undefined {
  return JAPANESE_BRANDS[brandKey.toLowerCase()]
}

/**
 * Returns true if the listing title starts with a known Japanese brand name.
 * Used as a post-filter when `japanese_only` is set on the profile.
 */
export function isJapaneseBrand(title: string): boolean {
  const lower = title.toLowerCase()
  return Object.keys(JAPANESE_BRANDS).some(brand => lower.includes(brand))
}
