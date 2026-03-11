/**
 * Writes the scraper heartbeat to data/status.json.
 * Read by GET /api/status to show the live status dot in the sidebar.
 */

import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import type { StatusFile, ScraperStatus } from '@/lib/types'

const STATUS_PATH = path.resolve(process.cwd(), './data/status.json')

export async function writeStatusFile(
  status: ScraperStatus,
  activeProfiles: number,
  lastError?: string,
): Promise<void> {
  const interval = parseInt(process.env.SCRAPE_INTERVAL_MINUTES ?? '5', 10)
  const now = new Date()
  const next = new Date(now.getTime() + interval * 60 * 1_000)

  const payload: StatusFile = {
    status,
    lastRunAt:      now.toISOString(),
    nextRunAt:      next.toISOString(),
    activeProfiles,
    ...(lastError ? { lastError } : {}),
  }

  mkdirSync(path.dirname(STATUS_PATH), { recursive: true })
  writeFileSync(STATUS_PATH, JSON.stringify(payload, null, 2), 'utf-8')
}
