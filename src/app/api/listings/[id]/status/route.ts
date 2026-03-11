import { NextResponse } from 'next/server'
import { db } from '@/db'
import { listings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { listingStatusSchema } from '@/lib/validation'

// ─── PATCH /api/listings/[id]/status ─────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = listingStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const now = new Date().toISOString()
  const [updated] = db
    .update(listings)
    .set({ status: parsed.data.status, updatedAt: now })
    .where(eq(listings.id, id))
    .returning()
    .all()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(updated)
}
