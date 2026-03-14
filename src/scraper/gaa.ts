import type { Page } from 'playwright'
import { extractYear, parseMileage, parsePrice, type ScrapedListing } from './shared'

const INVENTORY_URL = 'https://www.gaaautosales.com/inventory/'
const DEFAULT_LOCATION = 'Largo, FL'

interface RawDealerCard {
  href: string
  title: string | null
  priceText: string | null
  mileageText: string | null
  imageUrl: string | null
}

function absoluteUrl(href: string): string {
  return href.startsWith('http') ? href : new URL(href, INVENTORY_URL).toString()
}

function parseDealerCard(card: RawDealerCard): ScrapedListing | null {
  const fbUrl = absoluteUrl(card.href)
  const title = card.title?.trim()

  if (!title) return null

  return {
    fbListingId: fbUrl,
    title,
    price: card.priceText ? parsePrice(card.priceText) : null,
    mileage: card.mileageText ? parseMileage(card.mileageText) : null,
    year: extractYear(title),
    location: DEFAULT_LOCATION,
    fbUrl,
    imageUrl: card.imageUrl ?? null,
    sellerType: 'dealer',
  }
}

async function getLastPageNumber(page: Page): Promise<number> {
  const pages = await page.$$eval('ul.pagination a.page-link', links =>
    links
      .map(link => {
        const href = link.getAttribute('href') ?? ''
        const match = href.match(/[?&]page_no=(\d+)/)
        return match ? parseInt(match[1], 10) : null
      })
      .filter((value): value is number => value !== null),
  )

  return pages.length > 0 ? Math.max(...pages) : 1
}

async function extractCards(page: Page): Promise<ScrapedListing[]> {
  const rawCards = await page.$$eval('.dws-listing-item', nodes =>
    nodes.map(node => {
      const titleLink = node.querySelector<HTMLAnchorElement>('.dws-listing-title a.view-details-link')
      const priceValue = node.querySelector<HTMLElement>('.dws-listing-price.vehicle-price .field-value')
      const mileageValue = node.querySelector<HTMLElement>('.dws-vehicle-field-mileage .dws-vehicle-listing-item-field-value')
      const imageHolder = node.querySelector<HTMLElement>('.dws-listing-image-holder')

      return {
        href: titleLink?.href ?? '',
        title: titleLink?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        priceText: priceValue?.textContent?.trim() ?? null,
        mileageText: mileageValue?.textContent?.trim() ? `${mileageValue.textContent.trim()} miles` : null,
        imageUrl: imageHolder?.getAttribute('data-background-image') ?? null,
      }
    }),
  )

  return rawCards
    .map(parseDealerCard)
    .filter((listing): listing is ScrapedListing => listing !== null)
}

export async function scrapeGaaInventory(page: Page): Promise<ScrapedListing[]> {
  const listings = new Map<string, ScrapedListing>()

  await page.goto(INVENTORY_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  try {
    await page.waitForSelector('.dws-listing-item', { timeout: 15_000 })
  } catch {
    return []
  }

  const lastPage = await getLastPageNumber(page)

  for (let pageNo = 1; pageNo <= lastPage; pageNo++) {
    if (pageNo > 1) {
      await page.goto(`${INVENTORY_URL}?page_no=${pageNo}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForSelector('.dws-listing-item', { timeout: 15_000 })
    }

    const pageListings = await extractCards(page)
    for (const listing of pageListings) {
      listings.set(listing.fbListingId, listing)
    }
  }

  return Array.from(listings.values())
}
