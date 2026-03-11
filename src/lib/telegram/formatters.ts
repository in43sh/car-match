import type { Listing, CarfaxReport, SearchProfile } from '@/db/schema'

// ─── HTML escaping ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ─── Listing alert ────────────────────────────────────────────────────────────

export function formatListingAlert(listing: Listing, profileName: string): string {
  const price   = listing.price   != null ? `$${listing.price.toLocaleString('en-US')}` : 'Price not listed'
  const year    = listing.year    != null ? `📅 ${listing.year}` : null
  const mileage = listing.mileage != null ? `🛣 ${listing.mileage.toLocaleString('en-US')} miles` : null
  const loc     = listing.location ? `📍 ${esc(listing.location)}` : null

  return [
    `🚗 <b>New Match</b> — ${esc(listing.title)}`,
    '',
    `💰 ${price}`,
    year,
    mileage,
    loc,
    `🏷 ${esc(profileName)}`,
    '',
    `<a href="${listing.fbUrl}">View Listing →</a>`,
  ].filter(Boolean).join('\n')
}

// ─── Carfax summary ───────────────────────────────────────────────────────────

export function formatCarfaxSummary(report: CarfaxReport): string {
  const verdictLine =
    report.verdict === 'pass'    ? '✅ <b>PASS</b>' :
    report.verdict === 'caution' ? '⚠️ <b>CAUTION</b>' :
    report.verdict === 'fail'    ? '❌ <b>FAIL</b>' :
                                   '❓ <b>UNKNOWN</b>'

  const titleText = (() => {
    if (!report.titleIssues) return 'Clean'
    try {
      const issues = JSON.parse(report.titleIssues) as string[]
      return issues.length ? issues.join(', ') : 'Clean'
    } catch {
      return report.titleIssues
    }
  })()

  const rollback = report.odometerRollback ? '⚠️ Detected' : '✅ Clean'

  const lines: string[] = [
    '📋 <b>Carfax Report</b>',
    '',
    verdictLine,
    '',
    `👤 Owners: ${report.ownerCount ?? '—'}`,
    `💥 Accidents: ${report.accidentCount ?? '—'}`,
    `📜 Title: ${titleText}`,
    `🔄 Odometer: ${rollback}`,
  ]

  if (report.lastOdometer != null) {
    lines.push(`🔢 Last reading: ${report.lastOdometer.toLocaleString('en-US')} mi`)
  }

  if (report.verdictReasons) {
    try {
      const reasons = JSON.parse(report.verdictReasons) as string[]
      if (reasons.length > 0) {
        lines.push('', '<b>Issues:</b>')
        reasons.forEach(r => lines.push(`• ${esc(r)}`))
      }
    } catch { /* ignore */ }
  }

  return lines.join('\n')
}

// ─── Recent listing summary (for /recent command) ─────────────────────────────

export function formatRecentListing(listing: Listing, index: number): string {
  const price   = listing.price != null ? `$${listing.price.toLocaleString('en-US')}` : '?'
  const mileage = listing.mileage != null ? `${Math.round(listing.mileage / 1000)}k mi` : '?'
  const year    = listing.year ?? '?'

  return `${index + 1}. <a href="${listing.fbUrl}">${esc(listing.title)}</a>\n` +
         `   ${year} · ${price} · ${mileage} · <i>${listing.status}</i>`
}

// ─── Profile name lookup helper ───────────────────────────────────────────────

export function formatProfileName(profile: SearchProfile | null): string {
  return profile?.name ?? 'Unknown profile'
}
