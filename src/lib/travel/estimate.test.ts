import { describe, expect, it } from 'vitest'
import { haversineDistanceMetres, makeGeometricEstimator } from './estimate'

describe('haversineDistanceMetres', () => {
  it('is zero for the same point', () => {
    expect(haversineDistanceMetres({ lat: 51.46, lng: -0.01 }, { lat: 51.46, lng: -0.01 })).toBe(0)
  })

  it('roughly matches the known distance between two London landmarks (~1.9km)', () => {
    // Tower Bridge to St Paul's Cathedral, approx 1.9km as the crow flies.
    const d = haversineDistanceMetres({ lat: 51.5055, lng: -0.0754 }, { lat: 51.5138, lng: -0.0984 })
    expect(d).toBeGreaterThan(1700)
    expect(d).toBeLessThan(2100)
  })
})

describe('makeGeometricEstimator', () => {
  it('applies the road factor, speed, and fixed overhead as documented', () => {
    // Choose two points exactly 10km apart (roughly, via a fixed test vector) and check the formula directly.
    const origin = { lat: 51.46, lng: -0.01 }
    const dest = { lat: 51.5502, lng: -0.01 } // ~10km north
    const distanceMetres = haversineDistanceMetres(origin, dest)

    const estimate = makeGeometricEstimator({ roadFactor: 1.3, defaultSpeedKmh: 25, fixedOverheadMinutes: 5 })
    const minutes = estimate(origin, dest, new Date('2026-08-25T12:00:00Z'))

    const expectedMinutes = (distanceMetres * 1.3) / ((25 * 1000) / 60) + 5
    expect(minutes).toBeCloseTo(expectedMinutes, 6)
  })

  it('uses the hour-bucket speed when provided, falling back to the default otherwise', () => {
    const origin = { lat: 0, lng: 0 }
    const dest = { lat: 0, lng: 1 }
    const estimate = makeGeometricEstimator({
      roadFactor: 1,
      fixedOverheadMinutes: 0,
      defaultSpeedKmh: 30,
      speedByHourKmh: { 8: 10 }, // rush hour, much slower
    })

    const rushHour = estimate(origin, dest, new Date('2026-08-25T08:30:00Z'))
    const offPeak = estimate(origin, dest, new Date('2026-08-25T14:30:00Z'))
    expect(rushHour).toBeGreaterThan(offPeak) // slower speed -> more minutes for the same distance
  })

  it('defaults are conservative: a higher road factor and lower speed never produce a shorter estimate', () => {
    const origin = { lat: 51.46, lng: -0.01 }
    const dest = { lat: 51.5, lng: -0.05 }
    const conservative = makeGeometricEstimator({ roadFactor: 1.3, defaultSpeedKmh: 25 })
    const optimistic = makeGeometricEstimator({ roadFactor: 1.0, defaultSpeedKmh: 40 })
    const at = new Date('2026-08-25T12:00:00Z')
    expect(conservative(origin, dest, at)).toBeGreaterThan(optimistic(origin, dest, at))
  })
})
