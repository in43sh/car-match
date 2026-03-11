import { NextResponse } from 'next/server'
import { db } from '@/db'
import { carfaxReports, listings } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ─── GET /api/carfax/[id] ─────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const row = db
    .select({ report: carfaxReports, listingTitle: listings.title })
    .from(carfaxReports)
    .leftJoin(listings, eq(carfaxReports.listingId, listings.id))
    .where(eq(carfaxReports.id, id))
    .get()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...row.report, listingTitle: row.listingTitle ?? null })
}
