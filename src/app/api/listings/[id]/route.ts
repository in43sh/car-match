import { NextResponse } from 'next/server'
import { db } from '@/db'
import { listings, searchProfiles, carfaxReports } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ─── GET /api/listings/[id] ───────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const row = db
    .select({
      listing:     listings,
      profileName: searchProfiles.name,
    })
    .from(listings)
    .leftJoin(searchProfiles, eq(listings.profileId, searchProfiles.id))
    .where(eq(listings.id, id))
    .get()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Attach most recent carfax report if present
  const carfax = db
    .select()
    .from(carfaxReports)
    .where(eq(carfaxReports.listingId, id))
    .orderBy(carfaxReports.createdAt)  // most recently created last
    .all()
    .at(-1) ?? null

  return NextResponse.json({
    ...row.listing,
    profileName: row.profileName ?? null,
    carfax,
  })
}

// ─── DELETE /api/listings/[id] ────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const [deleted] = db
    .delete(listings)
    .where(eq(listings.id, id))
    .returning()
    .all()

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
