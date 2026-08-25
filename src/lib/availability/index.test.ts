import { describe, expect, it } from 'vitest'
import { computeAvailability } from './index'
import type {
  BookingSettingsInput,
  ComputeAvailabilityInput,
  LatLng,
  ServiceInput,
} from './types'

const tz = 'Europe/London'
const defaultSettings: BookingSettingsInput = {
  slotGranularityMinutes: 60,
  minNoticeMinutes: 0,
  maxAdvanceDays: 365,
  assignmentRule: 'least_utilised',
}
const oneHourService: ServiceInput = { durationMinutes: 60, bufferAfterMinutes: 0 }
const now = new Date('2026-08-01T00:00:00Z')

function baseInput(overrides: Partial<ComputeAvailabilityInput> = {}): ComputeAvailabilityInput {
  return {
    timezone: tz,
    now,
    businessHours: [],
    staff: [],
    bookings: [],
    blackouts: [],
    service: oneHourService,
    from: '2026-08-25',
    to: '2026-08-25',
    settings: defaultSettings,
    ...overrides,
  }
}

// 2026-08-25 is a Tuesday (weekday 2)
const TUESDAY = 2

describe('computeAvailability — empty day', () => {
  it('returns no slots when the business is not open that weekday', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: 1, opensLocal: '09:00', closesLocal: '17:00' }], // Monday only
        staff: [{ id: 'sam', hours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' }] }],
        staffId: 'sam',
      }),
    )
    expect(result.days).toEqual([{ date: '2026-08-25', slots: [] }])
  })

  it('returns an empty (not missing) day when hours exist but staff has none', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' }],
        staff: [{ id: 'sam', hours: [] }],
        staffId: 'sam',
      }),
    )
    expect(result.days).toHaveLength(1)
    expect(result.days[0].slots).toEqual([])
  })
})

describe('computeAvailability — full day, single staff matching business hours', () => {
  it('generates one slot per granularity step across the whole window', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' }],
        staff: [{ id: 'sam', hours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' }] }],
        staffId: 'sam',
      }),
    )
    const slots = result.days[0].slots
    expect(slots).toHaveLength(8) // 09:00 .. 16:00
    expect(slots[0].startsAt.toISOString()).toBe('2026-08-25T08:00:00.000Z') // 09:00 BST = 08:00 UTC
    expect(slots.at(-1)!.startsAt.toISOString()).toBe('2026-08-25T15:00:00.000Z') // 16:00 BST
    expect(slots.every((s) => s.staffId === 'sam')).toBe(true)
  })
})

describe('computeAvailability — back-to-back bookings', () => {
  it('subtracts an existing booking and allows a candidate to start exactly when it ends', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' }],
        staff: [{ id: 'sam', hours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' }] }],
        staffId: 'sam',
        settings: { ...defaultSettings, slotGranularityMinutes: 30 },
        service: { durationMinutes: 30, bufferAfterMinutes: 0 },
        bookings: [
          {
            staffId: 'sam',
            startsAt: new Date('2026-08-25T09:00:00.000Z'), // 10:00-11:00 BST
            endsAt: new Date('2026-08-25T10:00:00.000Z'),
          },
        ],
      }),
    )
    const starts = result.days[0].slots.map((s) => s.startsAt.toISOString())
    expect(starts).not.toContain('2026-08-25T09:00:00.000Z') // 10:00 BST, inside the booking
    expect(starts).not.toContain('2026-08-25T09:30:00.000Z') // 10:30 BST, inside the booking
    expect(starts).toContain('2026-08-25T10:00:00.000Z') // 11:00 BST, exactly when the booking ends
  })
})

describe('computeAvailability — staff hours narrower than business hours', () => {
  it('intersects business hours with staff hours', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '18:00' }],
        staff: [{ id: 'sam', hours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '13:00' }] }],
        staffId: 'sam',
      }),
    )
    const slots = result.days[0].slots
    expect(slots).toHaveLength(4) // starts at 09:00, 10:00, 11:00, 12:00 — last slot must end by 13:00
    expect(slots.at(-1)!.endsAt.toISOString()).toBe('2026-08-25T12:00:00.000Z') // 13:00 BST end, staff's own close time
  })
})

describe('computeAvailability — "Anyone" across multiple staff', () => {
  const twoStaffHours = [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '11:00' }]

  it('unions availability across staff, one slot per distinct start time', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '11:00' }],
        staff: [
          { id: 'sam', hours: twoStaffHours },
          { id: 'alex', hours: twoStaffHours },
        ],
        // staffId omitted: "Anyone"
      }),
    )
    const slots = result.days[0].slots
    expect(slots).toHaveLength(2) // 09:00 and 10:00, not 4 — deduped across staff
  })

  it('assigns the least-utilised staff member when both are free at the same time (default rule)', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '11:00' }],
        staff: [
          { id: 'sam', hours: twoStaffHours },
          { id: 'alex', hours: twoStaffHours },
        ],
        bookings: [
          // Sam already has a booking today elsewhere in their schedule; Alex has none.
          {
            staffId: 'sam',
            startsAt: new Date('2026-08-25T12:00:00.000Z'),
            endsAt: new Date('2026-08-25T12:30:00.000Z'),
          },
        ],
      }),
    )
    const slots = result.days[0].slots
    expect(slots.every((s) => s.staffId === 'alex')).toBe(true)
  })

  it('first_available always picks the first staff member in input order', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '11:00' }],
        staff: [
          { id: 'alex', hours: twoStaffHours },
          { id: 'sam', hours: twoStaffHours },
        ],
        settings: { ...defaultSettings, assignmentRule: 'first_available' },
      }),
    )
    expect(result.days[0].slots.every((s) => s.staffId === 'alex')).toBe(true)
  })
})

describe('computeAvailability — min notice and max advance', () => {
  it('trims slots that start before the minimum notice period', () => {
    const nowInstant = new Date('2026-08-25T09:30:00.000Z') // 10:30 BST
    const hours = [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' }]
    const staff = [{ id: 'sam', hours }]

    const restricted = computeAvailability(
      baseInput({
        now: nowInstant,
        businessHours: hours,
        staff,
        staffId: 'sam',
        settings: { ...defaultSettings, minNoticeMinutes: 120 }, // earliest bookable: 12:30 BST
      }),
    )
    const unrestricted = computeAvailability(
      baseInput({
        now: nowInstant,
        businessHours: hours,
        staff,
        staffId: 'sam',
        settings: { ...defaultSettings, minNoticeMinutes: 0 },
      }),
    )

    const earliestAllowed = new Date(nowInstant.getTime() + 120 * 60_000)
    const slots = restricted.days[0].slots
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.every((s) => s.startsAt.getTime() >= earliestAllowed.getTime())).toBe(true)
    expect(slots.length).toBeLessThan(unrestricted.days[0].slots.length)
  })

  it('excludes dates entirely beyond the max advance window', () => {
    const result = computeAvailability(
      baseInput({
        from: '2026-08-25',
        to: '2026-08-27',
        businessHours: [
          { weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' },
          { weekday: 3, opensLocal: '09:00', closesLocal: '17:00' },
          { weekday: 4, opensLocal: '09:00', closesLocal: '17:00' },
        ],
        staff: [
          {
            id: 'sam',
            hours: [
              { weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' },
              { weekday: 3, opensLocal: '09:00', closesLocal: '17:00' },
              { weekday: 4, opensLocal: '09:00', closesLocal: '17:00' },
            ],
          },
        ],
        staffId: 'sam',
        settings: { ...defaultSettings, maxAdvanceDays: 1 }, // now = 2026-08-01, so nothing past 2026-08-02 is bookable
      }),
    )
    expect(result.days.every((d) => d.slots.length === 0)).toBe(true)
  })
})

describe('computeAvailability — blackouts', () => {
  it('a business-wide blackout (staffId null) blocks every staff member', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '11:00' }],
        staff: [{ id: 'sam', hours: [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '11:00' }] }],
        staffId: 'sam',
        blackouts: [
          {
            staffId: null,
            startsAt: new Date('2026-08-25T00:00:00.000Z'),
            endsAt: new Date('2026-08-25T23:59:59.000Z'),
          },
        ],
      }),
    )
    expect(result.days[0].slots).toEqual([])
  })

  it('a staff-specific blackout only blocks that staff member', () => {
    const hours = [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '11:00' }]
    const result = computeAvailability(
      baseInput({
        businessHours: hours,
        staff: [
          { id: 'sam', hours },
          { id: 'alex', hours },
        ],
        blackouts: [
          {
            staffId: 'sam',
            startsAt: new Date('2026-08-25T00:00:00.000Z'),
            endsAt: new Date('2026-08-25T23:59:59.000Z'),
          },
        ],
      }),
    )
    expect(result.days[0].slots.every((s) => s.staffId === 'alex')).toBe(true)
  })
})

describe('computeAvailability — DST fixtures affect real slot counts', () => {
  const hours = [{ weekday: 0, opensLocal: '00:00', closesLocal: '05:00' }] // Sunday

  it('spring-forward Sunday has fewer 60-minute slots than a normal Sunday', () => {
    const earlyNow = new Date('2026-01-01T00:00:00Z') // both fixture dates are after `now`
    const spring = computeAvailability(
      baseInput({
        now: earlyNow,
        from: '2026-03-29',
        to: '2026-03-29',
        businessHours: hours,
        staff: [{ id: 'sam', hours }],
        staffId: 'sam',
      }),
    )
    const normal = computeAvailability(
      baseInput({
        now: earlyNow,
        from: '2026-03-22',
        to: '2026-03-22',
        businessHours: hours,
        staff: [{ id: 'sam', hours }],
        staffId: 'sam',
      }),
    )
    expect(spring.days[0].slots.length).toBeLessThan(normal.days[0].slots.length)
  })

  it('fall-back Sunday has more 60-minute slots than a normal Sunday', () => {
    const fallBack = computeAvailability(
      baseInput({
        from: '2026-10-25',
        to: '2026-10-25',
        businessHours: hours,
        staff: [{ id: 'sam', hours }],
        staffId: 'sam',
      }),
    )
    const normal = computeAvailability(
      baseInput({
        from: '2026-10-18',
        to: '2026-10-18',
        businessHours: hours,
        staff: [{ id: 'sam', hours }],
        staffId: 'sam',
      }),
    )
    expect(fallBack.days[0].slots.length).toBeGreaterThan(normal.days[0].slots.length)
  })
})

describe('computeAvailability — midnight-spanning window', () => {
  it('generates slots that cross midnight', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: [{ weekday: TUESDAY, opensLocal: '22:00', closesLocal: '02:00' }],
        staff: [{ id: 'sam', hours: [{ weekday: TUESDAY, opensLocal: '22:00', closesLocal: '02:00' }] }],
        staffId: 'sam',
        settings: { ...defaultSettings, slotGranularityMinutes: 60 },
      }),
    )
    const slots = result.days[0].slots
    // 22:00-02:00 BST = 4 hours -> 22:00, 23:00, 00:00, 01:00 with a 60 min service
    expect(slots).toHaveLength(4)
    expect(slots.at(-1)!.endsAt.toISOString()).toBe('2026-08-26T01:00:00.000Z') // 02:00 BST next day
  })
})

describe('computeAvailability — mobile module, the flagship travel-feasibility test', () => {
  // "Run a test that seeds a day with two bookings across town and assert that the engine
  // hides the slot that cannot be reached in time. That single test is the product."
  // — planning/10-build-order.md, Monday. Mirrors S8 in planning/03-users-and-jobs.md.
  const BASE: LatLng = { lat: 0, lng: 0 }
  const NORTH: LatLng = { lat: 0, lng: 50 }
  const SOUTH: LatLng = { lat: 0, lng: 150 }
  const DESTINATION: LatLng = { lat: 0, lng: 140 } // the new customer's address: near SOUTH, far from NORTH

  function fakeEstimator(origin: LatLng, dest: LatLng): number {
    return Math.hypot(dest.lat - origin.lat, dest.lng - origin.lng)
  }

  const hours = [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' }]

  it('offers 12:30 and hides 14:00, because 14:00 cannot reach the 15:00 south job in time', () => {
    const result = computeAvailability(
      baseInput({
        businessHours: hours,
        staff: [{ id: 'sam', hours, baseLocation: BASE }],
        staffId: 'sam',
        settings: { ...defaultSettings, slotGranularityMinutes: 30 },
        bookings: [
          {
            staffId: 'sam',
            startsAt: new Date('2026-08-25T09:00:00Z'), // 10:00 BST, north
            endsAt: new Date('2026-08-25T10:00:00Z'),
            location: NORTH,
          },
          {
            staffId: 'sam',
            startsAt: new Date('2026-08-25T14:00:00Z'), // 15:00 BST, south
            endsAt: new Date('2026-08-25T15:00:00Z'),
            location: SOUTH,
          },
        ],
        mobile: {
          destination: DESTINATION,
          serviceAreas: [],
          travelPolicy: { maxLegMinutes: 120, maxDailyDriveMinutes: 240 },
          estimate: fakeEstimator,
        },
      }),
    )

    const starts = result.days[0].slots.map((s) => s.startsAt.toISOString())
    expect(starts).toContain('2026-08-25T11:30:00.000Z') // 12:30 BST — offered
    expect(starts).not.toContain('2026-08-25T13:00:00.000Z') // 14:00 BST — hidden
  })
})

describe('computeAvailability — mobile module, out of area', () => {
  it('returns an empty result with outOfArea when the destination falls outside every service area', () => {
    const hours = [{ weekday: TUESDAY, opensLocal: '09:00', closesLocal: '17:00' }]
    const result = computeAvailability(
      baseInput({
        businessHours: hours,
        staff: [{ id: 'sam', hours, baseLocation: { lat: 51.46, lng: -0.01 } }],
        staffId: 'sam',
        mobile: {
          destination: { lat: 55.0, lng: -3.0 }, // Edinburgh, nowhere near London
          serviceAreas: [{ staffId: null, centre: { lat: 51.46, lng: -0.01 }, radiusMetres: 20_000 }],
          travelPolicy: { maxLegMinutes: 120, maxDailyDriveMinutes: 240 },
          estimate: () => 0,
        },
      }),
    )
    expect(result.outOfArea).toBe(true)
    expect(result.days).toEqual([])
  })
})
