import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { db } from '@/db'
import { searchProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { StatusFile, StatusResponse } from '@/lib/types'

const STATUS_PATH = path.resolve(process.cwd(), './data/status.json')

export async function GET() {
  let file: StatusFile | null = null

  if (existsSync(STATUS_PATH)) {
    try {
      file = JSON.parse(readFileSync(STATUS_PATH, 'utf-8')) as StatusFile
    } catch {
      // ignore malformed file
    }
  }

  const activeProfiles = db
    .select({ id: searchProfiles.id })
    .from(searchProfiles)
    .where(eq(searchProfiles.isActive, true))
    .all().length

  const response: StatusResponse = {
    scraper:        file?.status        ?? 'idle',
    lastRunAt:      file?.lastRunAt     ?? null,
    nextRunAt:      file?.nextRunAt     ?? null,
    activeProfiles,
  }

  return NextResponse.json(response)
}
