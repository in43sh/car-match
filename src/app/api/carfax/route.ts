import { NextResponse } from 'next/server'
import { db } from '@/db'
import { carfaxReports, listings } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { parseCarfaxHtml } from '@/lib/carfax/parser'
import { buildVerdict } from '@/lib/carfax/verdict'

// ─── GET /api/carfax ──────────────────────────────────────────────────────────

export async function GET() {
  const rows = db
    .select({
      report:       carfaxReports,
      listingTitle: listings.title,
    })
    .from(carfaxReports)
    .leftJoin(listings, eq(carfaxReports.listingId, listings.id))
    .orderBy(desc(carfaxReports.createdAt))
    .all()

  return NextResponse.json(
    rows.map(({ report, listingTitle }) => ({ ...report, listingTitle: listingTitle ?? null })),
  )
}

// ─── POST /api/carfax ─────────────────────────────────────────────────────────
// Body: { url?: string, html?: string, listingId?: number }
// At least one of url or html is required.

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { url, html: rawHtml, listingId } = body

  if (!url && !rawHtml) {
    return NextResponse.json({ error: 'Provide url or html' }, { status: 400 })
  }
  if (url     != null && typeof url     !== 'string') return NextResponse.json({ error: 'url must be a string' },       { status: 400 })
  if (rawHtml != null && typeof rawHtml !== 'string') return NextResponse.json({ error: 'html must be a string' },      { status: 400 })
  if (listingId != null && (!Number.isInteger(listingId) || (listingId as number) < 1)) {
    return NextResponse.json({ error: 'listingId must be a positive integer' }, { status: 400 })
  }
  if (url && !/^https:\/\/api\.carfax\.shop\/report\/view\?hash=/.test(url as string)) {
    return NextResponse.json({ error: 'Invalid carfax.shop URL' }, { status: 422 })
  }

  // Fetch HTML if URL provided
  let html: string
  if (url) {
    let res: Response
    try {
      res = await fetch(url as string, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
    } catch (err) {
      return NextResponse.json({ error: `Fetch error: ${String(err)}` }, { status: 502 })
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: HTTP ${res.status}` }, { status: 502 })
    }
    html = await res.text()
  } else {
    html = rawHtml as string
  }

  const parsed = parseCarfaxHtml(html)

  // Get listing mileage for discrepancy check
  const lid = typeof listingId === 'number' ? listingId : null
  let listingMileage: number | null = null
  if (lid) {
    const row = db.select({ mileage: listings.mileage }).from(listings).where(eq(listings.id, lid)).get()
    listingMileage = row?.mileage ?? null
  }

  const verdict = buildVerdict(parsed, listingMileage)
  const verdictMap: Record<string, 'pass' | 'caution' | 'fail'> = {
    clean:   'pass',
    caution: 'caution',
    avoid:   'fail',
  }

  const now = new Date().toISOString()
  const [report] = db
    .insert(carfaxReports)
    .values({
      listingId:        lid,
      carfaxUrl:        (url as string | undefined) ?? '',
      accidentCount:    parsed.accidents,
      ownerCount:       parsed.owners,
      titleIssues:      parsed.titleIssues ? JSON.stringify(['Title issue detected']) : null,
      odometerRollback: parsed.odometerRollback,
      lastOdometer:     parsed.lastOdometer,
      rawSummary:       verdict.telegramMessage,
      verdict:          verdictMap[verdict.score],
      verdictReasons:   verdict.flags.length ? JSON.stringify(verdict.flags) : null,
      parsedAt:         now,
    })
    .returning()
    .all()

  return NextResponse.json(report, { status: 201 })
}
