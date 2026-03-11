import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { searchProfiles } from '@/db/schema'
import { updateProfileSchema } from '@/lib/validation'
import { eq } from 'drizzle-orm'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const profileId = parseInt(id, 10)
  if (isNaN(profileId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { isActive, ...rest } = parsed.data
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date().toISOString() }
  if (isActive !== undefined) updates.isActive = isActive

  const [profile] = db
    .update(searchProfiles)
    .set(updates)
    .where(eq(searchProfiles.id, profileId))
    .returning()
    .all()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const profileId = parseInt(id, 10)
  if (isNaN(profileId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const [deleted] = db
    .delete(searchProfiles)
    .where(eq(searchProfiles.id, profileId))
    .returning()
    .all()

  if (!deleted) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
