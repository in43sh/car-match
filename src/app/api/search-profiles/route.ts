import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { searchProfiles } from '@/db/schema'
import { createProfileSchema } from '@/lib/validation'
import { asc } from 'drizzle-orm'

export async function GET() {
  const profiles = db
    .select()
    .from(searchProfiles)
    .orderBy(asc(searchProfiles.createdAt))
    .all()

  return NextResponse.json({ profiles })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createProfileSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const [profile] = db
    .insert(searchProfiles)
    .values({ ...parsed.data, createdAt: now, updatedAt: now })
    .returning()
    .all()

  return NextResponse.json({ profile }, { status: 201 })
}
