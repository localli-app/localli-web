import { haversineDistanceMetres } from '../travel/estimate'
import type { BookingInput, LatLng, MobileInput, ServiceAreaInput, StaffInput } from './types'

/**
 * Step 0 of the mobile path: cheap and short-circuits everything else.
 * `eligibleStaffIds` is the staff member being checked (one id), or every eligible staff member for "Anyone".
 */
export function isInServiceArea(
  destination: LatLng,
  serviceAreas: ServiceAreaInput[],
  eligibleStaffIds: string[],
): boolean {
  if (serviceAreas.length === 0) return true
  const applicable = serviceAreas.filter(
    (a) => a.staffId === null || eligibleStaffIds.includes(a.staffId),
  )
  return applicable.some((a) => haversineDistanceMetres(a.centre, destination) <= a.radiusMetres)
}

interface FeasibilityInput {
  staff: StaffInput
  candidateStart: Date
  candidateEnd: Date
  /** The working-hours window this candidate falls inside, i.e. where the staff member's day is anchored at base. */
  window: { start: Date; end: Date }
  /** This staff member's bookings on the same business-local calendar date, sorted by startsAt. */
  sameDayBookings: BookingInput[]
  mobile: MobileInput
}

export interface FeasibilityResult {
  feasible: boolean
  travelInMinutes: number
  travelOutMinutes: number
}

/**
 * Pairwise feasibility against the immediately preceding and following booking that day, falling back to
 * base at the edges of the working window. See planning/05-domain-model.md, "Mobile path", step 5.
 * Pairwise is a deliberate v1 simplification: it catches essentially everything real for a handful of jobs
 * a day, at the cost of missing rarer knock-on effects across three or more legs.
 */
export function checkTravelFeasibility(input: FeasibilityInput): FeasibilityResult {
  const { staff, candidateStart, candidateEnd, window, sameDayBookings, mobile } = input
  const base = staff.baseLocation ?? mobile.destination

  const prev = [...sameDayBookings]
    .filter((b) => b.endsAt <= candidateStart)
    .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0]
  const next = [...sameDayBookings]
    .filter((b) => b.startsAt >= candidateEnd)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]

  const prevLocation = prev?.location ?? base
  const prevEnd = prev?.endsAt ?? window.start
  const nextLocation = next?.location ?? base
  const nextStart = next?.startsAt ?? window.end

  const travelInMinutes = mobile.estimate(prevLocation, mobile.destination, candidateStart)
  const travelOutMinutes = mobile.estimate(mobile.destination, nextLocation, candidateEnd)

  const gapBeforeMinutes = (candidateStart.getTime() - prevEnd.getTime()) / 60_000
  const gapAfterMinutes = (nextStart.getTime() - candidateEnd.getTime()) / 60_000

  const existingDriveMinutes = sameDayBookings.reduce(
    (sum, b) => sum + (b.travelInMinutes ?? 0) + (b.travelOutMinutes ?? 0),
    0,
  )
  const dayDriveTotal = existingDriveMinutes + travelInMinutes + travelOutMinutes

  const feasible =
    gapBeforeMinutes >= travelInMinutes &&
    gapAfterMinutes >= travelOutMinutes &&
    travelInMinutes <= mobile.travelPolicy.maxLegMinutes &&
    travelOutMinutes <= mobile.travelPolicy.maxLegMinutes &&
    dayDriveTotal <= mobile.travelPolicy.maxDailyDriveMinutes

  return { feasible, travelInMinutes, travelOutMinutes }
}
