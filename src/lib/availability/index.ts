import { clipIntervals, intersectIntervalLists, subtractIntervalLists, type Interval } from './intervals'
import { generateCandidateStarts } from './candidates'
import { checkTravelFeasibility, isInServiceArea } from './mobile'
import {
  businessIntervalsForDate,
  enumerateLocalDates,
  instantToLocalDate,
  staffIntervalsForDate,
} from './windows'
import type {
  AssignmentRule,
  BookingInput,
  ComputeAvailabilityInput,
  ComputeAvailabilityResult,
  DaySlots,
  LocalDate,
  Slot,
  StaffInput,
} from './types'

export * from './types'
export { generateCandidateStarts } from './candidates'
export { isInServiceArea, checkTravelFeasibility } from './mobile'
export { enumerateLocalDates, instantToLocalDate, weekdayOf } from './windows'

/**
 * Computes bookable slots for a business, service, date range, and optionally a staff member.
 * Pure: no I/O. The caller loads hours, bookings, and blackouts, and injects `now` and a travel
 * estimator so results are fully deterministic. See planning/05-domain-model.md, "Availability engine".
 *
 * Callers MUST pass only calendar-occupying bookings (status 'confirmed' or 'in_progress') —
 * this module has no concept of booking status.
 */
export function computeAvailability(input: ComputeAvailabilityInput): ComputeAvailabilityResult {
  const { timezone, now, businessHours, staff, bookings, blackouts, service, from, to, settings, staffId, mobile } =
    input

  const eligibleStaff = staffId ? staff.filter((s) => s.id === staffId) : staff
  const dates = enumerateLocalDates(from, to)

  if (eligibleStaff.length === 0) {
    return { days: dates.map((date) => ({ date, slots: [] })) }
  }

  if (mobile) {
    const eligibleIds = eligibleStaff.map((s) => s.id)
    if (!isInServiceArea(mobile.destination, mobile.serviceAreas, eligibleIds)) {
      return { days: [], outOfArea: true }
    }
  }

  const totalMinutes =
    service.durationMinutes +
    service.bufferAfterMinutes +
    (service.setupMinutes ?? 0) +
    (service.packdownMinutes ?? 0)

  const minNoticeInstant = new Date(now.getTime() + settings.minNoticeMinutes * 60_000)
  const maxAdvanceInstant = new Date(now.getTime() + settings.maxAdvanceDays * 24 * 60 * 60_000)

  const days: DaySlots[] = dates.map((date) => {
    const businessIntervals = businessIntervalsForDate(date, businessHours, timezone)
    if (businessIntervals.length === 0) return { date, slots: [] }

    const staffSlots = new Map<string, Slot[]>()
    const utilisationByStaff = new Map<string, number>()

    for (const s of eligibleStaff) {
      const staffIntervals = staffIntervalsForDate(date, s.hours, timezone)
      if (staffIntervals.length === 0) continue

      const working = intersectIntervalLists(businessIntervals, staffIntervals)
      if (working.length === 0) continue

      const staffBookings = bookings.filter((b) => b.staffId === s.id)
      const sameDayBookings = staffBookings
        .filter((b) => instantToLocalDate(b.startsAt, timezone) === date)
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      utilisationByStaff.set(s.id, sameDayBookings.length)

      const occupied: Interval[] = staffBookings.map((b) => ({ start: b.startsAt, end: b.endsAt }))
      const businessBlackouts = blackouts.filter((bl) => bl.staffId === null || bl.staffId === s.id)
      for (const bl of businessBlackouts) occupied.push({ start: bl.startsAt, end: bl.endsAt })

      let free = subtractIntervalLists(working, occupied)
      free = clipIntervals(free, minNoticeInstant, maxAdvanceInstant)
      if (free.length === 0) continue

      const candidateStarts = generateCandidateStarts(free, totalMinutes, settings.slotGranularityMinutes)
      const slots: Slot[] = []

      for (const startsAt of candidateStarts) {
        const endsAt = new Date(startsAt.getTime() + totalMinutes * 60_000)

        if (mobile) {
          const window = working.find((w) => startsAt >= w.start && endsAt <= w.end)
          if (!window) continue
          const { feasible, travelInMinutes, travelOutMinutes } = checkTravelFeasibility({
            staff: s,
            candidateStart: startsAt,
            candidateEnd: endsAt,
            window,
            sameDayBookings,
            mobile,
          })
          if (!feasible) continue
          slots.push({ startsAt, endsAt, staffId: s.id, travelInMinutes, travelOutMinutes })
        } else {
          slots.push({ startsAt, endsAt, staffId: s.id })
        }
      }

      if (slots.length > 0) staffSlots.set(s.id, slots)
    }

    const slots = staffId
      ? [...staffSlots.values()].flat().sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      : assignAcrossStaff(staffSlots, eligibleStaff, utilisationByStaff, settings.assignmentRule)

    return { date, slots }
  })

  return { days }
}

/**
 * For "Anyone", multiple staff can offer the same clock time. Collapse each distinct start time to a
 * single slot, picking which staff member is shown, per the business's assignment rule. The actual
 * assignment is re-confirmed at booking time; this only decides what the customer sees.
 */
function assignAcrossStaff(
  staffSlots: Map<string, Slot[]>,
  eligibleStaff: StaffInput[],
  utilisationByStaff: Map<string, number>,
  rule: AssignmentRule,
): Slot[] {
  const staffOrder = eligibleStaff.map((s) => s.id)
  const byStartTime = new Map<number, Slot[]>()

  for (const slots of staffSlots.values()) {
    for (const slot of slots) {
      const key = slot.startsAt.getTime()
      const existing = byStartTime.get(key)
      if (existing) existing.push(slot)
      else byStartTime.set(key, [slot])
    }
  }

  const byStaffOrder = (a: Slot, b: Slot) => staffOrder.indexOf(a.staffId) - staffOrder.indexOf(b.staffId)

  const sortedTimes = [...byStartTime.keys()].sort((a, b) => a - b)
  const result: Slot[] = []
  let roundRobinCounter = 0

  for (const time of sortedTimes) {
    const candidates = byStartTime.get(time)!
    let chosen: Slot

    if (rule === 'first_available') {
      chosen = [...candidates].sort(byStaffOrder)[0]
    } else if (rule === 'round_robin') {
      const sorted = [...candidates].sort(byStaffOrder)
      chosen = sorted[roundRobinCounter % sorted.length]
      roundRobinCounter += 1
    } else {
      chosen = [...candidates].sort((a, b) => {
        const utilDiff = (utilisationByStaff.get(a.staffId) ?? 0) - (utilisationByStaff.get(b.staffId) ?? 0)
        return utilDiff !== 0 ? utilDiff : byStaffOrder(a, b)
      })[0]
    }

    result.push(chosen)
  }

  return result
}

/** The next-N-available slots across the whole range, flattened and sorted. Powers the "next 3 available" buttons. */
export function nextAvailableSlots(
  input: ComputeAvailabilityInput,
  count = 3,
): { startsAt: Date; endsAt: Date; staffId: string }[] {
  const result = computeAvailability(input)
  const flat = result.days
    .flatMap((d) => d.slots)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  return flat.slice(0, count)
}

export type { BookingInput, LocalDate }
