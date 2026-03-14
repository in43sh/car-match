import type { SearchProfile } from '@/db/schema'
import { isJapaneseBrand } from './brands'

export interface ScrapedListing {
  fbListingId: string
  title: string
  price: number | null
  mileage: number | null
  year: number | null
  location: string | null
  fbUrl: string
  imageUrl: string | null
  sellerType: 'private' | 'dealer' | null
}

export function parsePrice(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, '')
  if (!digits) return null
  return parseInt(digits, 10)
}

export function parseMileage(text: string): number | null {
  const match = text.match(/^([0-9,]+(?:\.[0-9]+)?)\s*(K)?\s*miles?$/i)
  if (!match) return null
  const num = parseFloat(match[1].replace(/,/g, ''))
  return match[2] ? Math.round(num * 1000) : Math.round(num)
}

export function extractYear(title: string): number | null {
  const match = title.match(/^(19|20)\d{2}\b/)
  return match ? parseInt(match[0], 10) : null
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function titleMatchesMake(title: string, make: string | null): boolean {
  if (!make) return true
  return normalizeToken(title).includes(normalizeToken(make))
}

function titleMatchesModel(title: string, modelText: string | null): boolean {
  if (!modelText) return true
  return normalizeToken(title).includes(normalizeToken(modelText))
}

export function matchesProfile(listing: ScrapedListing, profile: SearchProfile): boolean {
  if (listing.sellerType === 'dealer' && !profile.includeDealers) return false
  if (listing.sellerType === 'private' && !profile.includePrivate) return false

  if (!titleMatchesMake(listing.title, profile.make)) {
    return false
  }

  if (!titleMatchesModel(listing.title, profile.modelText ?? null)) {
    return false
  }

  if (profile.maxPrice != null && listing.price != null && listing.price > profile.maxPrice) {
    return false
  }

  if (profile.maxMileage != null && listing.mileage != null && listing.mileage > profile.maxMileage) {
    return false
  }

  if (profile.minYear != null && listing.year != null && listing.year < profile.minYear) {
    return false
  }

  if (profile.japaneseOnly && !isJapaneseBrand(listing.title)) {
    return false
  }

  return true
}
