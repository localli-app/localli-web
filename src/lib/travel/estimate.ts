/**
 * Stage 1 (v1) travel estimation: geometric, not a routing API.
 * Every constant is per-business configurable by the caller. Bias every
 * default conservative — the failure mode of an optimistic estimate is a
 * provider arriving late, which destroys the trust the product runs on.
 * See planning/05-domain-model.md, "Travel estimation, staged".
 */
import type { LatLng } from '../availability/types'

const EARTH_RADIUS_METRES = 6_371_000

export function haversineDistanceMetres(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)))
  return EARTH_RADIUS_METRES * c
}

export interface GeometricEstimatorConfig {
  /** Straight-line distance multiplier accounting for real road routing. Default 1.3. */
  roadFactor?: number
  /** km/h, by hour-of-day bucket (0-23). Falls back to `defaultSpeedKmh` for an unlisted hour. */
  speedByHourKmh?: Partial<Record<number, number>>
  defaultSpeedKmh?: number
  /** Parking, door-to-door, finding the flat. Default 5. */
  fixedOverheadMinutes?: number
}

/** Builds a TravelEstimator (see availability/types.ts) using the Stage 1 geometric formula. */
export function makeGeometricEstimator(config: GeometricEstimatorConfig = {}) {
  const {
    roadFactor = 1.3,
    speedByHourKmh = {},
    defaultSpeedKmh = 25,
    fixedOverheadMinutes = 5,
  } = config

  return function estimate(origin: LatLng, dest: LatLng, at: Date): number {
    const roadDistanceMetres = haversineDistanceMetres(origin, dest) * roadFactor
    const hour = at.getUTCHours()
    const speedKmh = speedByHourKmh[hour] ?? defaultSpeedKmh
    const speedMetresPerMinute = (speedKmh * 1000) / 60
    return roadDistanceMetres / speedMetresPerMinute + fixedOverheadMinutes
  }
}
