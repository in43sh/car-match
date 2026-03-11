import { NextResponse } from 'next/server'
import { db } from '@/db'
import { listings, searchProfiles } from '@/db/schema'
import { eq, desc, and, inArray } from 'drizzle-orm'
import type { ListingStatus } from '@/lib/types'

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
  }))

  return NextResponse.json(data)
}
