import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import type { Interval } from './intervals'
import type { LocalDate, LocalTime, StaffWeeklyHours, WeeklyHours } from './types'

/** Local wall-clock date + time in a given IANA zone, converted to the correct UTC instant. Handles DST. */
export function localDateTimeToInstant(date: LocalDate, time: LocalTime, timezone: string): Date {
  return fromZonedTime(`${date}T${time}:00`, timezone)
}

/**
 * The business-local calendar date (YYYY-MM-DD) that an instant falls on, in a given IANA zone.
 * `toZonedTime` returns a Date whose UTC getters carry the target zone's wall clock — read it with
 * getUTC*, never local getters, or this silently breaks on any machine not running in UTC.
 */
export function instantToLocalDate(instant: Date, timezone: string): LocalDate {
  const zoned = toZonedTime(instant, timezone)
  const y = zoned.getUTCFullYear()
  const m = String(zoned.getUTCMonth() + 1).padStart(2, '0')
  const d = String(zoned.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysToLocalDate(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().slice(0, 10)
}

/** Weekday of a business-local calendar date. 0 = Sunday .. 6 = Saturday. Independent of any timezone conversion. */
export function weekdayOf(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Every business-local calendar date from `from` to `to`, inclusive. */
export function enumerateLocalDates(from: LocalDate, to: LocalDate): LocalDate[] {
  const dates: LocalDate[] = []
  let cursor = from
  // Loose upper bound so a caller mistake (to < from) can't spin forever.
  for (let i = 0; i < 400 && cursor <= to; i++) {
    dates.push(cursor)
    cursor = addDaysToLocalDate(cursor, 1)
  }
  return dates
}

/**
 * Turn one weekly-hours row into a concrete instant interval for a specific calendar date.
 * A close time at or before the open time (e.g. 20:00-02:00) is treated as spanning into the next day.
 */
export function hoursToInterval(date: LocalDate, hours: WeeklyHours, timezone: string): Interval {
  const start = localDateTimeToInstant(date, hours.opensLocal, timezone)
  const closesNextDay = hours.closesLocal <= hours.opensLocal
  const closeDate = closesNextDay ? addDaysToLocalDate(date, 1) : date
  const end = localDateTimeToInstant(closeDate, hours.closesLocal, timezone)
  return { start, end }
}

function isEffective(date: LocalDate, hours: StaffWeeklyHours): boolean {
  if (hours.effectiveFrom && date < hours.effectiveFrom) return false
  if (hours.effectiveTo && date > hours.effectiveTo) return false
  return true
}

export function businessIntervalsForDate(
  date: LocalDate,
  businessHours: WeeklyHours[],
  timezone: string,
): Interval[] {
  const weekday = weekdayOf(date)
  return businessHours
    .filter((h) => h.weekday === weekday)
    .map((h) => hoursToInterval(date, h, timezone))
}

export function staffIntervalsForDate(
  date: LocalDate,
  staffHours: StaffWeeklyHours[],
  timezone: string,
): Interval[] {
  const weekday = weekdayOf(date)
  return staffHours
    .filter((h) => h.weekday === weekday && isEffective(date, h))
    .map((h) => hoursToInterval(date, h, timezone))
}
