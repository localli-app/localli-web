import { describe, expect, it } from 'vitest'
import { checkTravelFeasibility, isInServiceArea } from './mobile'
import type { LatLng, MobileInput, StaffInput } from './types'

/**
 * A deterministic estimator for tests: treats the numeric difference between two points as minutes
 * directly, so travel times are exact and easy to reason about, independent of the real (haversine-based)
 * geometric estimator, which has its own tests in src/lib/travel/estimate.test.ts.
 */
function fakeEstimator(origin: LatLng, dest: LatLng): number {
  return Math.hypot(dest.lat - origin.lat, dest.lng - origin.lng)
}

describe('isInServiceArea', () => {
  const centre: LatLng = { lat: 51.46, lng: -0.01 }

  it('is unrestricted when the business has no service areas', () => {
    expect(isInServiceArea({ lat: 0, lng: 0 }, [], ['sam'])).toBe(true)
  })

  it('is true inside the radius, false outside it', () => {
    const areas = [{ staffId: null, centre, radiusMetres: 5000 }]
    expect(isInServiceArea({ lat: 51.46, lng: -0.01 }, areas, ['sam'])).toBe(true) // same point
    expect(isInServiceArea({ lat: 52.0, lng: 0.5 }, areas, ['sam'])).toBe(false) // ~70km away
  })

  it('a staff-specific area only applies to that staff member', () => {
    const areas = [{ staffId: 'sam', centre, radiusMetres: 5000 }]
    expect(isInServiceArea(centre, areas, ['sam'])).toBe(true)
    expect(isInServiceArea(centre, areas, ['alex'])).toBe(false)
  })
})

describe('checkTravelFeasibility — the flagship mobile scenario', () => {
  // planning/03-users-and-jobs.md, S8: "Provider has a 10:00 job north and a 15:00 job south.
  // The page offers 12:30 and hides 14:00, because 14:00 could not reach the 15:00 in time."
  const BASE: LatLng = { lat: 0, lng: 0 }
  const NORTH: LatLng = { lat: 0, lng: 50 } // 50 "minutes" from base
  const SOUTH: LatLng = { lat: 0, lng: 150 } // 150 minutes from base, 100 from NORTH
  const DESTINATION: LatLng = { lat: 0, lng: 140 } // 10 minutes from SOUTH, 90 from NORTH

  const staff: StaffInput = { id: 'sam', hours: [], baseLocation: BASE }
  const window = { start: new Date('2026-08-25T08:00:00Z'), end: new Date('2026-08-25T16:00:00Z') } // 09:00-17:00 BST

  const jobNorth = {
    staffId: 'sam',
    startsAt: new Date('2026-08-25T09:00:00Z'), // 10:00 BST
    endsAt: new Date('2026-08-25T10:00:00Z'), // 11:00 BST
    location: NORTH,
  }
  const jobSouth = {
    staffId: 'sam',
    startsAt: new Date('2026-08-25T14:00:00Z'), // 15:00 BST
    endsAt: new Date('2026-08-25T15:00:00Z'), // 16:00 BST
    location: SOUTH,
  }
  const sameDayBookings = [jobNorth, jobSouth]

  const mobile: MobileInput = {
    destination: DESTINATION,
    serviceAreas: [],
    travelPolicy: { maxLegMinutes: 120, maxDailyDriveMinutes: 240 },
    estimate: fakeEstimator,
  }

  it('offers 12:30 — comfortable gaps on both sides', () => {
    const candidateStart = new Date('2026-08-25T11:30:00Z') // 12:30 BST
    const candidateEnd = new Date('2026-08-25T12:30:00Z') // 60-minute service
    const result = checkTravelFeasibility({
      staff,
      candidateStart,
      candidateEnd,
      window,
      sameDayBookings,
      mobile,
    })
    expect(result.feasible).toBe(true)
    expect(result.travelInMinutes).toBe(90) // NORTH -> DESTINATION
    expect(result.travelOutMinutes).toBe(10) // DESTINATION -> SOUTH
  })

  it('hides 14:00 — cannot reach the 15:00 south job in time', () => {
    const candidateStart = new Date('2026-08-25T13:00:00Z') // 14:00 BST
    const candidateEnd = new Date('2026-08-25T14:00:00Z') // ends exactly when the south job starts
    const result = checkTravelFeasibility({
      staff,
      candidateStart,
      candidateEnd,
      window,
      sameDayBookings,
      mobile,
    })
    expect(result.feasible).toBe(false)
    expect(result.travelOutMinutes).toBe(10) // needs 10 minutes, has 0
  })
})

describe('checkTravelFeasibility — base fallback at the edges of the day', () => {
  const BASE: LatLng = { lat: 0, lng: 0 }
  const DESTINATION: LatLng = { lat: 0, lng: 20 } // 20 minutes from base
  const staff: StaffInput = { id: 'sam', hours: [], baseLocation: BASE }
  const window = { start: new Date('2026-08-25T08:00:00Z'), end: new Date('2026-08-25T16:00:00Z') }
  const mobile: MobileInput = {
    destination: DESTINATION,
    serviceAreas: [],
    travelPolicy: { maxLegMinutes: 60, maxDailyDriveMinutes: 240 },
    estimate: fakeEstimator,
  }

  it('the first job of the day must allow time to travel from base', () => {
    // Window opens at 08:00. Starting at 08:10 leaves only 10 minutes to cover a 20-minute trip from base.
    const result = checkTravelFeasibility({
      staff,
      candidateStart: new Date('2026-08-25T08:10:00Z'),
      candidateEnd: new Date('2026-08-25T09:10:00Z'),
      window,
      sameDayBookings: [],
      mobile,
    })
    expect(result.feasible).toBe(false)
  })

  it('starting late enough in the window to cover the trip from base is feasible', () => {
    const result = checkTravelFeasibility({
      staff,
      candidateStart: new Date('2026-08-25T08:20:00Z'),
      candidateEnd: new Date('2026-08-25T09:20:00Z'),
      window,
      sameDayBookings: [],
      mobile,
    })
    expect(result.feasible).toBe(true)
  })

  it('the last job of the day must allow time to travel back to base', () => {
    // Window closes at 16:00. A job ending at 15:50 leaves only 10 minutes for a 20-minute trip home.
    const result = checkTravelFeasibility({
      staff,
      candidateStart: new Date('2026-08-25T14:50:00Z'),
      candidateEnd: new Date('2026-08-25T15:50:00Z'),
      window,
      sameDayBookings: [],
      mobile,
    })
    expect(result.feasible).toBe(false)
  })
})

describe('checkTravelFeasibility — policy caps', () => {
  const BASE: LatLng = { lat: 0, lng: 0 }
  const staff: StaffInput = { id: 'sam', hours: [], baseLocation: BASE }
  const window = { start: new Date('2026-08-25T00:00:00Z'), end: new Date('2026-08-25T23:00:00Z') }

  it('rejects a leg longer than maxLegMinutes even with a comfortable gap', () => {
    const destination: LatLng = { lat: 0, lng: 100 } // 100-minute leg
    const mobile: MobileInput = {
      destination,
      serviceAreas: [],
      travelPolicy: { maxLegMinutes: 45, maxDailyDriveMinutes: 400 },
      estimate: fakeEstimator,
    }
    const result = checkTravelFeasibility({
      staff,
      candidateStart: new Date('2026-08-25T10:00:00Z'),
      candidateEnd: new Date('2026-08-25T11:00:00Z'),
      window,
      sameDayBookings: [],
      mobile,
    })
    expect(result.feasible).toBe(false)
  })

  it('rejects a candidate that would push the day past maxDailyDriveMinutes, counting travel already on the books', () => {
    const destination: LatLng = { lat: 0, lng: 50 }
    const priorJob = {
      staffId: 'sam',
      startsAt: new Date('2026-08-25T09:00:00Z'),
      endsAt: new Date('2026-08-25T09:30:00Z'),
      location: { lat: 0, lng: 5 },
      travelInMinutes: 90,
      travelOutMinutes: 90, // 180 minutes already committed today
    }
    const mobile: MobileInput = {
      destination,
      serviceAreas: [],
      travelPolicy: { maxLegMinutes: 60, maxDailyDriveMinutes: 200 }, // only 20 minutes of budget left
      estimate: fakeEstimator,
    }
    const result = checkTravelFeasibility({
      staff,
      candidateStart: new Date('2026-08-25T12:00:00Z'),
      candidateEnd: new Date('2026-08-25T13:00:00Z'),
      window,
      sameDayBookings: [priorJob],
      mobile,
    })
    // Both legs for this candidate are individually within maxLegMinutes (45 in, 50 out),
    // but 180 already committed + 95 more = 275, which blows the 200-minute daily cap.
    expect(result.feasible).toBe(false)
    expect(result.travelInMinutes).toBeLessThanOrEqual(60)
    expect(result.travelOutMinutes).toBeLessThanOrEqual(60)
  })
})
