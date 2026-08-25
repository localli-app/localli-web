import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { computeAvailability } from './index'
import { hoursToInterval, localDateTimeToInstant } from './windows'
import type { BookingInput, WeeklyHours } from './types'

/**
 * Property tests on the two invariants that must never break, per CLAUDE.md testing rules:
 * no returned slot overlaps an existing booking, and every returned slot lies inside both
 * business and staff hours.
 */

const tz = 'Europe/London'
const date = '2026-08-25' // a Tuesday, well clear of any DST transition
const weekday = 2
const now = new Date('2026-08-01T00:00:00Z')

function pad(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

const hoursArb: fc.Arbitrary<WeeklyHours> = fc
  .tuple(fc.integer({ min: 6, max: 19 }), fc.integer({ min: 6, max: 19 }))
  .filter(([a, b]) => a < b)
  .map(([open, close]) => ({ weekday, opensLocal: pad(open), closesLocal: pad(close) }))

const bookingHoursArb = fc.uniqueArray(fc.integer({ min: 6, max: 19 }), { maxLength: 4 })

function localHourToInstant(hour: number): Date {
  return localDateTimeToInstant(date, pad(hour), tz)
}

describe('availability engine — property invariants', () => {
  it('no returned slot overlaps an existing booking, and every slot lies within business and staff hours', () => {
    fc.assert(
      fc.property(
        hoursArb,
        hoursArb,
        bookingHoursArb,
        fc.constantFrom(15, 30, 60),
        fc.constantFrom(15, 30, 45, 60),
        (businessHours, staffHours, bookingStartHours, granularity, durationMinutes) => {
          const bookings: BookingInput[] = bookingStartHours.map((h) => ({
            staffId: 'sam',
            startsAt: localHourToInstant(h),
            endsAt: localHourToInstant(h + 1), // 1-hour bookings on distinct hours: never overlap each other
          }))

          const result = computeAvailability({
            timezone: tz,
            now,
            businessHours: [businessHours],
            staff: [{ id: 'sam', hours: [staffHours] }],
            bookings,
            blackouts: [],
            service: { durationMinutes, bufferAfterMinutes: 0 },
            from: date,
            to: date,
            settings: {
              slotGranularityMinutes: granularity,
              minNoticeMinutes: 0,
              maxAdvanceDays: 365,
              assignmentRule: 'least_utilised',
            },
            staffId: 'sam',
          })

          const businessInterval = hoursToInterval(date, businessHours, tz)
          const staffInterval = hoursToInterval(date, staffHours, tz)

          for (const slot of result.days[0].slots) {
            expect(slot.startsAt.getTime()).toBeGreaterThanOrEqual(businessInterval.start.getTime())
            expect(slot.endsAt.getTime()).toBeLessThanOrEqual(businessInterval.end.getTime())
            expect(slot.startsAt.getTime()).toBeGreaterThanOrEqual(staffInterval.start.getTime())
            expect(slot.endsAt.getTime()).toBeLessThanOrEqual(staffInterval.end.getTime())

            for (const b of bookings) {
              const overlaps =
                slot.startsAt.getTime() < b.endsAt.getTime() && slot.endsAt.getTime() > b.startsAt.getTime()
              expect(overlaps).toBe(false)
            }
          }
        },
      ),
      { numRuns: 500 },
    )
  })
})
