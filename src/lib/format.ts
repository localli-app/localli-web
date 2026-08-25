import { formatInTimeZone } from 'date-fns-tz'

/**
 * Money is integer minor units with a currency code beside it. Never a float,
 * never a decimal that came out of the database as a JS number.
 */
export function formatMoney(amountMinor: number, currency: string, locale = 'en-GB'): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100)
  return formatted
}

/**
 * "75 min", "150 min". Bare minutes, matching the artboards: in a scannable
 * service list a single consistent unit compares faster than a mix of
 * "1 hr 15 min" and "45 min". Stays readable well past the ~180 min ceiling of
 * a realistic beauty service.
 */
export function formatDuration(minutes: number): string {
  return `${minutes} min`
}

/** "2:15pm", as the artboards render times. */
export function formatTime(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, 'h:mmaaa')
}

/** "Thursday 27 August" */
export function formatLongDate(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, 'EEEE d MMMM')
}

/** "Thursday 27 August, 2:15pm" */
export function formatLongDateTime(instant: Date, timezone: string): string {
  return `${formatLongDate(instant, timezone)}, ${formatTime(instant, timezone)}`
}

/** Business-local calendar date, "YYYY-MM-DD". */
export function localDateOf(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, 'yyyy-MM-dd')
}

/**
 * "Today" / "Tomorrow" / "Thursday", relative to `now` in the business's zone.
 * The next-available buttons lead with this, since a weekday name is a decision
 * and a date is arithmetic.
 */
export function relativeDayLabel(instant: Date, timezone: string, now: Date): string {
  const target = localDateOf(instant, timezone)
  const today = localDateOf(now, timezone)
  if (target === today) return 'Today'

  const tomorrowInstant = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (target === localDateOf(tomorrowInstant, timezone)) return 'Tomorrow'

  // Inside the next week, a weekday name is unambiguous and friendlier than a date.
  const sixDaysOut = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000)
  if (target <= localDateOf(sixDaysOut, timezone)) {
    return formatInTimeZone(instant, timezone, 'EEEE')
  }
  return formatInTimeZone(instant, timezone, 'EEE d MMM')
}

/**
 * E.164 is the storage format; it is not what anyone reads. Renders GB numbers
 * the way the design shows them ("020 7946 0100", "07700 900123") and passes
 * anything else through untouched rather than guessing at a foreign format.
 */
export function formatPhoneForDisplay(e164: string): string {
  if (!e164.startsWith('+44')) return e164
  const national = `0${e164.slice(3)}`

  // Mobile: 07xxx xxxxxx
  if (/^07\d{9}$/.test(national)) {
    return `${national.slice(0, 5)} ${national.slice(5)}`
  }
  // 3-digit area codes (020 London, 023 Southampton, 024 Coventry, 028 NI): 0xx xxxx xxxx
  if (/^0(20|23|24|28|29)\d{8}$/.test(national)) {
    return `${national.slice(0, 3)} ${national.slice(3, 7)} ${national.slice(7)}`
  }
  // Most other geographic numbers: 0xxxx xxxxxx
  if (/^0\d{10}$/.test(national)) {
    return `${national.slice(0, 5)} ${national.slice(5)}`
  }
  return national
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "09:00" -> "9am", "19:30" -> "7:30pm". */
export function formatLocalTimeLabel(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  const hour = Number(hStr)
  const minute = Number(mStr)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return minute === 0 ? `${h12}${suffix}` : `${h12}:${String(minute).padStart(2, '0')}${suffix}`
}

/**
 * Collapses a weekly pattern into the one-line summary the landing shows,
 * e.g. "Tue–Sat, 9am–7pm · Closed Sun & Mon". Runs of consecutive days sharing
 * the same window are merged; anything irregular is listed day by day.
 */
export function summariseWeeklyHours(
  hours: { weekday: number; opensLocal: string; closesLocal: string }[],
): string {
  if (hours.length === 0) return ''

  // Week reads Monday-first for humans, even though weekday 0 is Sunday.
  const order = [1, 2, 3, 4, 5, 6, 0]
  const byDay = new Map<number, { opensLocal: string; closesLocal: string }>()
  for (const h of hours) byDay.set(h.weekday, h)

  const runs: { days: number[]; opensLocal: string; closesLocal: string }[] = []
  for (const day of order) {
    const entry = byDay.get(day)
    if (!entry) continue
    const last = runs.at(-1)
    const isConsecutive =
      last && order.indexOf(day) === order.indexOf(last.days.at(-1)!) + 1
    if (
      last &&
      isConsecutive &&
      last.opensLocal === entry.opensLocal &&
      last.closesLocal === entry.closesLocal
    ) {
      last.days.push(day)
    } else {
      runs.push({ days: [day], opensLocal: entry.opensLocal, closesLocal: entry.closesLocal })
    }
  }

  const openPart = runs
    .map((run) => {
      const label =
        run.days.length === 1
          ? DAY_NAMES[run.days[0]]
          : `${DAY_NAMES[run.days[0]]}–${DAY_NAMES[run.days.at(-1)!]}`
      return `${label}, ${formatLocalTimeLabel(run.opensLocal)}–${formatLocalTimeLabel(run.closesLocal)}`
    })
    .join(' · ')

  // Closed days read in natural week order (Sunday first), not the Monday-first
  // order used for the open runs — otherwise a Sun/Mon closure, the commonest
  // pattern in this trade, gets split across the week boundary as "Mon & Sun".
  const closed = [0, 1, 2, 3, 4, 5, 6].filter((d) => !byDay.has(d))
  if (closed.length === 0) return openPart

  const closedNames = closed.map((d) => DAY_NAMES[d])
  const closedLabel =
    closedNames.length === 1
      ? closedNames[0]
      : `${closedNames.slice(0, -1).join(', ')} & ${closedNames.at(-1)}`
  return `${openPart} · Closed ${closedLabel}`
}

/** "Tue" / "25" for the date strip. */
export function dayStripLabels(dateIso: string, timezone: string): { dow: string; num: string } {
  // Midday avoids any DST edge when turning a bare date into an instant for formatting.
  const instant = new Date(`${dateIso}T12:00:00Z`)
  return {
    dow: formatInTimeZone(instant, timezone, 'EEE'),
    num: formatInTimeZone(instant, timezone, 'd'),
  }
}
