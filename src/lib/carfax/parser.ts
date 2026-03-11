/**
 * CARFAX HTML parser — extracts structured data from a saved carfax.shop report page.
 *
 * Input: raw HTML string (either fetched via Playwright from the report URL,
 *        or read from an HTML file the user saved from their browser).
 *
 * URL pattern: https://api.carfax.shop/report/view?hash=<hash>
 *
 * Selector strategy:
 *   - All key summary fields are in .history-overview-row text (most stable)
 *   - Accident count: .accident-damage-record element count
 *   - Title issues: .common-section-cell-alert inside #title-history-section
 *   - Odometer rollback: any decrease in .record-odometer-reading sequence
 *
 * See docs/carfax.md for the full selector map.
 */

import * as cheerio from 'cheerio'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CarfaxReport {
  /** Number of accidents/damage events reported (0 = clean). */
  accidents: number
  /** Number of previous owners, or null if not found. */
  owners: number | null
  /** Last odometer reading CARFAX has on record (miles), or null. */
  lastOdometer: number | null
  /** True if any title brand issue found (salvage, junk, rebuilt, flood, lemon, etc.). */
  titleIssues: boolean
  /**
   * True if any odometer reading in the history record is LOWER than the one before it.
   * Note: CARFAX does not show an explicit "rollback" badge — this is inferred from history.
   * A more reliable rollback signal is when CARFAX's lastOdometer > listing mileage claimed
   * by the seller (checked in verdict.ts, not here).
   */
  odometerRollback: boolean
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseCarfaxHtml(html: string): CarfaxReport {
  const $ = cheerio.load(html)

  // ── Summary overview rows ──────────────────────────────────────────────────
  // Each .history-overview-row is a clickable summary line at the top of the report.
  // Text examples: "Accident reported", "3 Previous owners",
  //                "70,000 Last reported odometer reading", "No accidents reported"
  const overviewRows: string[] = []
  $('.history-overview-row').each((_, el) => {
    overviewRows.push($(el).text().trim().replace(/\s+/g, ' '))
  })

  // ── Accidents ─────────────────────────────────────────────────────────────
  // .accident-damage-record = one element per accident/damage event in the detail section.
  // The overview row says "Accident reported" (has issues) or "No accidents reported".
  const accidents = $('.accident-damage-record').length

  // ── Owners ────────────────────────────────────────────────────────────────
  // Overview row: "3 Previous owners" or "1 Previous owner"
  const ownersRow = overviewRows.find(t => /previous owner/i.test(t))
  const ownersMatch = ownersRow?.match(/^(\d+)/)
  const owners = ownersMatch ? parseInt(ownersMatch[1], 10) : null

  // ── Last reported odometer ────────────────────────────────────────────────
  // Overview row: "70,000 Last reported odometer reading"
  const odomRow = overviewRows.find(t => /last reported odometer/i.test(t))
  const odomMatch = odomRow?.match(/^([\d,]+)/)
  const lastOdometer = odomMatch ? parseInt(odomMatch[1].replace(/,/g, ''), 10) : null

  // ── Title issues ──────────────────────────────────────────────────────────
  // In the Title History section, each owner column shows either:
  //   - .common-section-cell-content + green checkmark = "Guaranteed No Problem"
  //   - .common-section-cell-alert = actual issue (salvage, flood, etc.)
  // Scoped to #title-history-section to avoid false positives from accident rows.
  const titleIssues = $('#title-history-section .common-section-cell-alert').length > 0

  // ── Odometer rollback ─────────────────────────────────────────────────────
  // Extract all numeric .record-odometer-reading values in document order
  // (matches the chronological order of the history timeline).
  // If any reading is lower than the previous numeric reading → rollback in recorded data.
  const readings: number[] = []
  $('.record-odometer-reading').each((_, el) => {
    const text = $(el).text().trim()
    const m = text.match(/^([\d,]+)\s*mi$/i)
    if (m) readings.push(parseInt(m[1].replace(/,/g, ''), 10))
  })
  const odometerRollback = readings.some((v, i) => i > 0 && v < readings[i - 1])

  return { accidents, owners, lastOdometer, titleIssues, odometerRollback }
}
