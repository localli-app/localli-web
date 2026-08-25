import { computeAvailability, type LatLng, type Slot } from '../availability'
import { addDaysToLocalDate } from '../availability/windows'
import { loadSlotSnapshot, type SlotSnapshot } from '../db/queries'
import { makeGeometricEstimator } from '../travel/estimate'
import { AppError } from '../errors'

/**
 * Orchestration between the database and the pure availability engine.
 * The engine itself never does I/O; this is where the snapshot is assembled.
 */

export interface SlotView {
  startsAt: string
  endsAt: string
  staffId: string
  staffName: string
  travelInMinutes?: number
  travelOutMinutes?: number
}

export interface DaySlotsView {
  date: string
  slots: SlotView[]
}

function toView(slot: Slot, snapshot: SlotSnapshot): SlotView {
  return {
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    staffId: slot.staffId,
    staffName: snapshot.staffNames.get(slot.staffId) ?? '',
    ...(slot.travelInMinutes === undefined
      ? {}
      : { travelInMinutes: Math.round(slot.travelInMinutes) }),
    ...(slot.travelOutMinutes === undefined
      ? {}
      : { travelOutMinutes: Math.round(slot.travelOutMinutes) }),
  }
}

export interface ComputeSlotsInput {
  businessId: string
  serviceId: string
  staffId?: string | null
  /** Business-local calendar dates, inclusive. */
  from: string
  to: string
  /** Mobile businesses only: the customer's address. */
  destination?: LatLng | null
  now?: Date
}

export async function computeSlots(input: ComputeSlotsInput): Promise<{
  timezone: string
  days: DaySlotsView[]
  outOfArea: boolean
}> {
  const now = input.now ?? new Date()

  // Widen the booking/blackout query a day either side, so an appointment that
  // runs across midnight still trims the neighbouring day correctly.
  const windowStart = new Date(`${addDaysToLocalDate(input.from, -1)}T00:00:00Z`)
  const windowEnd = new Date(`${addDaysToLocalDate(input.to, 2)}T00:00:00Z`)

  const snapshot = await loadSlotSnapshot({
    businessId: input.businessId,
    serviceId: input.serviceId,
    staffId: input.staffId,
    windowStart,
    windowEnd,
  })

  if (!snapshot) {
    throw new AppError('NOT_FOUND', 'That service is not available.')
  }

  const requiresAddress = snapshot.business.isMobile
  if (requiresAddress && !input.destination) {
    throw new AppError('VALIDATION_FAILED', 'An address is required to check availability.')
  }

  const result = computeAvailability({
    timezone: snapshot.business.timezone,
    now,
    businessHours: snapshot.businessHours,
    staff: snapshot.staff,
    bookings: snapshot.bookings,
    blackouts: snapshot.blackouts,
    service: {
      durationMinutes: snapshot.service.durationMinutes,
      bufferAfterMinutes: snapshot.service.bufferAfterMinutes,
      setupMinutes: snapshot.service.setupMinutes,
      packdownMinutes: snapshot.service.packdownMinutes,
    },
    from: input.from,
    to: input.to,
    settings: {
      slotGranularityMinutes: snapshot.business.settings.slotGranularityMinutes,
      minNoticeMinutes: snapshot.business.settings.minNoticeMinutes,
      maxAdvanceDays: snapshot.business.settings.maxAdvanceDays,
      assignmentRule: snapshot.business.settings.assignmentRule,
    },
    staffId: input.staffId,
    mobile:
      requiresAddress && input.destination
        ? {
            destination: input.destination,
            serviceAreas: snapshot.serviceAreas,
            travelPolicy: snapshot.travelPolicy,
            estimate: makeGeometricEstimator(snapshot.travelEstimatorConfig),
          }
        : undefined,
  })

  return {
    timezone: snapshot.business.timezone,
    outOfArea: result.outOfArea === true,
    days: result.days.map((d) => ({ date: d.date, slots: d.slots.map((s) => toView(s, snapshot)) })),
  }
}

/**
 * The three big buttons shown before any calendar. Most bookings should come
 * from here, so it scans forward day by day and stops as soon as it has enough
 * rather than computing the whole advance window.
 */
export async function nextAvailable(
  input: Omit<ComputeSlotsInput, 'from' | 'to'> & { fromDate: string; count?: number },
): Promise<{ timezone: string; slots: SlotView[]; outOfArea: boolean }> {
  const count = input.count ?? 3
  const CHUNK_DAYS = 7
  const MAX_CHUNKS = 5 // ~5 weeks out before giving up

  let cursor = input.fromDate
  const found: SlotView[] = []
  let timezone = 'UTC'

  for (let chunk = 0; chunk < MAX_CHUNKS && found.length < count; chunk++) {
    const to = addDaysToLocalDate(cursor, CHUNK_DAYS - 1)
    const result = await computeSlots({ ...input, from: cursor, to })
    timezone = result.timezone

    if (result.outOfArea) return { timezone, slots: [], outOfArea: true }

    for (const day of result.days) {
      // One suggestion per day: three buttons offering three times on the same
      // afternoon is a worse choice set than three different days.
      const first = day.slots[0]
      if (first) found.push(first)
      if (found.length >= count) break
    }
    cursor = addDaysToLocalDate(to, 1)
  }

  return { timezone, slots: found.slice(0, count), outOfArea: false }
}
