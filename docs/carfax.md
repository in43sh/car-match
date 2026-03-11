# carfax.shop DOM Selector Map

Confirmed by inspecting a live saved HTML page (2020 Toyota Corolla, 3 owners, 3 accidents).
Source: `https://api.carfax.shop/report/view?hash=<hash>`

---

## URL Pattern

```
https://api.carfax.shop/report/view?hash=<hex-hash>
```

Validator regex: `/^https:\/\/api\.carfax\.shop\/report\/view\?hash=/`

The hash is a long hex-encoded string. It expires — reports typically stay valid for days to weeks.

---

## Input Methods (bot workflow)

The parser (`src/lib/carfax/parser.ts`) takes raw HTML as a string. Two input paths:

1. **URL paste** — user sends `https://api.carfax.shop/report/view?hash=...` to the bot
   → Playwright loads the page and returns `page.content()`

2. **HTML file upload** — user saves the page in browser (Cmd+S → "Webpage, Complete")
   and uploads the `.html` file to the bot
   → Bot reads the file content directly (no Playwright needed)

PDF upload is also possible with `pdf-parse`, but HTML is preferred (preserves DOM structure).

---

## Confirmed Selectors

All summary fields live in `.history-overview-row` elements at the top of the report —
these are the most stable selectors as they are accessibility/navigation landmarks.

### `.history-overview-row` — Summary Items

Each is an `<a>` element. Full text examples from a real report:

```
"Accident reported"
"16 Service history records"
"Good Reliability"
"3 Previous owners"
"Types of owners: Personal lease, Personal"
"70,000 Last reported odometer reading"
```

Alternatively (clean report): `"No accidents reported"`

### Accident Count

```
.accident-damage-record
```

One element per accident/damage event in the detailed history section. Count `length`.
The overview row text tells you whether accidents exist; the element count gives the exact number.

### Owner Count

From `.history-overview-row` text matching `/(\d+)\s*Previous owner/i` → capture group 1.

### Last Reported Odometer

From `.history-overview-row` text matching `/([\d,]+)\s*Last reported odometer/i` → capture group 1.
Strip commas, parse as integer.

### Title Issues (Damage Brands / Odometer Brands)

```
#title-history-section .common-section-cell-alert
```

In the Title History table, each owner column cell uses:

- `.common-section-cell-content` + green checkmark SVG + `"Guaranteed No Problem"` → **clean**
- `.common-section-cell-alert` → **issue present** (salvage, junk, rebuilt, fire, flood, hail, lemon, or odometer brand)

Title issues are dealbreakers. Verdict score → `avoid` immediately.

### Odometer Rollback

```
.record-odometer-reading
```

One element per history record that has an odometer reading. Text examples:

```
"11 mi"
"4,513 mi"
"not reported"
"40,647 mi"
```

Regex to parse: `/^([\d,]+)\s*mi$/i`

**Rollback detection:**
Parse all numeric readings in document order (= chronological order).
If any reading is **lower** than the one before it → `odometerRollback = true`.

**Important:** CARFAX does not show an explicit "odometer rollback" badge.
A more reliable signal is comparing CARFAX's `lastOdometer` vs the listing's claimed mileage —
if CARFAX shows **more** miles than the seller claims, the seller may have rolled it back
after the last CARFAX reading. This check is done in `src/lib/carfax/verdict.ts`.

---

## Verdict Score Logic

Defined in `src/lib/carfax/verdict.ts`:

| Condition | Score |
| --- | --- |
| Title issue | `avoid` |
| Odometer rollback (history) | `avoid` |
| CARFAX odometer > listing mileage + 1,000 mi | `avoid` |
| Any accidents | `caution` |
| No issues | `clean` |

---

## Maintenance Notes

- If `.history-overview-row` stops matching → check if the anchor element type changed
- If `#title-history-section` selector breaks → fall back to `.title-history-section` (class)
- CARFAX periodically redesigns their report page; re-run a saved HTML through the parser
  after any visible layout change and check that all fields still extract correctly
