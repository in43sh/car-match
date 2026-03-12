import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { listings, searchProfiles } from '@/db/schema'
import { eq, desc, and, inArray } from 'drizzle-orm'
import type { ListingStatus } from '@/lib/types'
import { createListingSchema } from '@/lib/validation'

// ─── GET /api/listings ────────────────────────────────────────────────────────
// Query params:
//   status  — filter by status (new|interested|rejected|contacted)
//   profile — filter by profileId (integer)
//   limit   — max rows (default 50, max 200)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const statusParam  = searchParams.get('status')  as ListingStatus | null
  const profileParam = searchParams.get('profile')
  const limitParam   = searchParams.get('limit')

  const limit = Math.min(parseInt(limitParam ?? '50', 10) || 50, 200)

  const validStatuses: ListingStatus[] = ['new', 'interested', 'rejected', 'contacted']
  const statusFilter  = statusParam && validStatuses.includes(statusParam) ? statusParam : null
  const profileFilter = profileParam ? parseInt(profileParam, 10) : null

  const conditions = [
    statusFilter  ? eq(listings.status,    statusFilter)  : undefined,
    profileFilter ? eq(listings.profileId, profileFilter) : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[]

  const rows = db
    .select({
      listing: listings,
      profileName: searchProfiles.name,
    })
    .from(listings)
    .leftJoin(searchProfiles, eq(listings.profileId, searchProfiles.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(listings.createdAt))
    .limit(limit)
    .all()

  const data = rows.map(({ listing, profileName }) => ({
    ...listing,
    profileName: profileName ?? null,
    matchedProfileCount: listing.matchedProfileIds
      ? (JSON.parse(listing.matchedProfileIds) as number[]).length
      : 1,
  }))

  return NextResponse.json(data)
}

// ─── POST /api/listings ───────────────────────────────────────────────────────
// Manually add a listing by FB Marketplace URL + user-supplied details.

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createListingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { fbUrl, title, price, mileage, year, location, sellerType } = parsed.data

  const idMatch = fbUrl.match(/\/item\/(\d+)/)
  if (!idMatch) {
    return NextResponse.json({ error: 'Could not extract listing ID from URL' }, { status: 400 })
  }
  const fbListingId = idMatch[1]
  const cleanUrl = 'https://www.facebook.com/marketplace/item/' + fbListingId + '/'

  const existing = db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.fbListingId, fbListingId))
    .get()

  if (existing) {
    return NextResponse.json(
      { error: 'This listing is already in your database', existingId: existing.id },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const [inserted] = db.insert(listings).values({
    fbListingId,
    fbUrl:       cleanUrl,
    title,
    price:       price ?? null,
    mileage:     mileage ?? null,
    year:        year ?? null,
    location:    location ?? null,
    sellerType:  sellerType ?? null,
    status:      'new',
    matchedProfileIds: JSON.stringify([]),
    createdAt:   now,
    updatedAt:   now,
  }).returning().all()

  return NextResponse.json({ listing: inserted }, { status: 201 })
}
