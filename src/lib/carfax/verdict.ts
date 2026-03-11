/**
 * CARFAX verdict builder — converts parsed report data into a user-facing summary.
 *
 * Takes the parsed CarfaxReport plus the listing's claimed mileage (from the FB card)
 * and returns a structured verdict with a score and formatted message.
 *
 * Mileage discrepancy check (per user insight):
 *   CARFAX rarely flags odometer issues explicitly. The reliable signals are:
 *   1. Any decrease in the recorded odometer history (odometerRollback from parser)
 *   2. CARFAX's last recorded reading is HIGHER than what the seller claims on FB
 *      (seller may have rolled it back after the last CARFAX reading)
 */

import type { CarfaxReport } from './parser'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerdictScore = 'clean' | 'caution' | 'avoid'

export interface Verdict {
  score: VerdictScore
  /** Individual red flag strings, empty if clean. */
  flags: string[]
  /** Formatted multi-line message ready to send via Telegram. */
  telegramMessage: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

// ─── Verdict Builder ──────────────────────────────────────────────────────────

export function buildVerdict(report: CarfaxReport, listingMileage: number | null): Verdict {
  const flags: string[] = []

  // Title brands (salvage, junk, rebuilt, flood, lemon) — hard dealbreaker
  if (report.titleIssues) {
    flags.push('Title issue detected (salvage / junk / rebuilt / flood / lemon)')
  }

  // Odometer rollback in recorded history
  if (report.odometerRollback) {
    flags.push('Odometer rollback detected in CARFAX history records')
  }

  // Mileage discrepancy: CARFAX last reading > listing's claimed mileage
  // This means the car has MORE miles on record than the seller is advertising.
  if (report.lastOdometer != null && listingMileage != null) {
    const delta = report.lastOdometer - listingMileage
    if (delta > 1_000) {
      flags.push(
        `Mileage discrepancy: CARFAX last reading ${fmt(report.lastOdometer)} mi` +
        ` but listing claims ${fmt(listingMileage)} mi` +
        ` (${fmt(delta)} mi difference — possible rollback)`,
      )
    }
  }

  // Accidents
  if (report.accidents === 1) {
    flags.push('1 accident / damage event reported')
  } else if (report.accidents > 1) {
    flags.push(`${report.accidents} accidents / damage events reported`)
  }

  // Score
  const score: VerdictScore =
    report.titleIssues || report.odometerRollback || flags.some(f => f.includes('discrepancy'))
      ? 'avoid'
      : report.accidents > 0
        ? 'caution'
        : 'clean'

  // ── Format Telegram message ────────────────────────────────────────────────
  const scoreEmoji: Record<VerdictScore, string> = {
    clean:   '✅',
    caution: '⚠️',
    avoid:   '🚫',
  }

  const lines: string[] = []
  lines.push(`${scoreEmoji[score]} *CARFAX Report — ${score.toUpperCase()}*`)
  lines.push('')
  lines.push(`🔢 Accidents: ${report.accidents}`)
  lines.push(`👤 Owners: ${report.owners ?? 'unknown'}`)
  lines.push(`🔢 Last odometer: ${report.lastOdometer != null ? fmt(report.lastOdometer) + ' mi' : 'unknown'}`)
  lines.push(`📋 Title: ${report.titleIssues ? '⚠️ Issues found' : '✅ Clean'}`)
  lines.push(`🔄 Odometer history: ${report.odometerRollback ? '⚠️ Rollback detected' : '✅ Clean'}`)

  if (flags.length > 0) {
    lines.push('')
    lines.push('*Red flags:*')
    flags.forEach(f => lines.push(`• ${f}`))
  }

  return {
    score,
    flags,
    telegramMessage: lines.join('\n'),
  }
}
