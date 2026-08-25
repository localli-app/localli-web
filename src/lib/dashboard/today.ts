import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'
import {
  clipIntervals,
  intersectIntervalLists,
  subtractIntervalLists,
  type Interval,
} from '../availability/intervals'
import { businessIntervalsForDate, staffIntervalsForDate } from '../availability/windows'
import { makeGeometricEstimator } from '../travel/estimate'
import type { LatLng } from '../availability/types'

/** Statuses that occupy the calendar. Mirrors the partial EXCLUDE constraint. */
const OCCUPYING = ['confirmed', 'in_progress'] as const

export type AgendaStatus =
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled_by_customer'
  | 'cancelled_by_business'
  | 'pending_payment'

export interface AgendaBooking {
  kind: 'booking'
  id: string
  startsAt: Date
  endsAt: Date
  durationMinutes: number
  status: AgendaStatus
  serviceName: string
  priceMinor: number
  currency: string
  customerName: string
  customerPhone: string | null
  staffName: string
  address: string | null
  bookedAgo: Date
  source: string
  /** Estimated drive to the NEXT job, when this business travels. */
  driveToNextMinutes: number | null
}

export interface AgendaGap {
  kind: 'gap'
  startsAt: Date
  endsAt: Date
  minutes: number
  staffName: string
  /** Services that would fit in this gap, longest first. */
  fits: { id: string; name: string; durationMinutes: number }[]
}

export type AgendaEntry = AgendaBooking | AgendaGap

export interface TodayStats {
  bookingCount: number
  revenueMinor: number
  currency: string
  next: { at: Date; customerName: string; minutesAway: number } | null
  freeGapMinutes: number
  totalDriveMinutes: number | null
}

export interface TodayView {
  date: string
  stats: TodayStats
  entries: AgendaEntry[]
  staffNames: string[]
}

function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000)
}

/**
 * The default landing screen. Answers one question: what is happening today,
 * and is anything wrong.
 *
 * Gaps are computed, not inferred from the booking list, because unbooked time
 * inside the working day is lost revenue and naming it is what turns a passive
 * calendar into something that prompts action.
 */
export async function getTodayView(input: {
  businessId: string
  timezone: string
  /** Business-local calendar date, YYYY-MM-DD. */
  date: string
  now: Date
}): Promise<TodayView> {
  const { businessId, timezone, date, now } = input

  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) })
  if (!business) throw new Error('Business not found')

  // A day's agenda can legitimately include a booking that started yesterday
  // evening, so query a generous window and filter to the local date after.
  const dayStart = new Date(`${date}T00:00:00Z`)
  const windowStart = new Date(dayStart.getTime() - 86_400_000)
  const windowEnd = new Date(dayStart.getTime() + 2 * 86_400_000)

  const [staffRows, bookingRows, blackoutRows, hoursRows, serviceRows, policyRow, baseLoc] =
    await Promise.all([
      db
        .select()
        .from(s.staff)
        .where(and(eq(s.staff.businessId, businessId), eq(s.staff.isActive, true)))
        .orderBy(asc(s.staff.sortOrder)),
      db
        .select({
          id: s.bookings.id,
          staffId: s.bookings.staffId,
          startsAt: s.bookings.startsAt,
          endsAt: s.bookings.endsAt,
          status: s.bookings.status,
          priceMinor: s.bookings.priceMinor,
          currency: s.bookings.currency,
          source: s.bookings.source,
          createdAt: s.bookings.createdAt,
          serviceName: s.services.name,
          customerFirst: s.customers.firstName,
          customerLast: s.customers.lastName,
          customerPhone: s.customers.phone,
          staffName: s.staff.name,
          line1: s.locations.line1,
          postcode: s.locations.postcode,
          lat: s.locations.lat,
          lng: s.locations.lng,
        })
        .from(s.bookings)
        .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
        .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
        .innerJoin(s.staff, eq(s.staff.id, s.bookings.staffId))
        .leftJoin(s.locations, eq(s.locations.id, s.bookings.serviceLocationId))
        // Scoped by businessId from the session, never from a parameter.
        .where(
          and(
            eq(s.bookings.businessId, businessId),
            gte(s.bookings.startsAt, windowStart),
            lt(s.bookings.startsAt, windowEnd),
          ),
        )
        .orderBy(asc(s.bookings.startsAt)),
      db
        .select()
        .from(s.blackouts)
        .where(
          and(
            eq(s.blackouts.businessId, businessId),
            lt(s.blackouts.startsAt, windowEnd),
            gte(s.blackouts.endsAt, windowStart),
          ),
        ),
      db.select().from(s.businessHours).where(eq(s.businessHours.businessId, businessId)),
      db
        .select()
        .from(s.services)
        .where(and(eq(s.services.businessId, businessId), eq(s.services.isActive, true)))
        .orderBy(asc(s.services.sortOrder)),
      db.query.travelPolicies.findFirst({ where: eq(s.travelPolicies.businessId, businessId) }),
      business.addressLocationId
        ? db.query.locations.findFirst({ where: eq(s.locations.id, business.addressLocationId) })
        : Promise.resolve(undefined),
    ])

  const businessHours = hoursRows.map((h) => ({
    weekday: h.weekday,
    opensLocal: h.opensLocal.slice(0, 5),
    closesLocal: h.closesLocal.slice(0, 5),
  }))

  const staffHoursRows =
    staffRows.length > 0
      ? await db
          .select()
          .from(s.staffHours)
          .where(inArray(s.staffHours.staffId, staffRows.map((r) => r.id)))
      : []

  const businessWindows = businessIntervalsForDate(date, businessHours, timezone)

  // Only bookings that actually fall on this local date belong on the agenda.
  const onThisDate = bookingRows.filter((b) => {
    const localDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(b.startsAt)
    return localDay === date
  })

  const occupying = onThisDate.filter((b) =>
    (OCCUPYING as readonly string[]).includes(b.status),
  )

  // ── Gaps ──────────────────────────────────────────────────────────────
  // Computed per staff member, because a slot is bookable if ANY staff member
  // is free, not only when everyone is.
  const estimator = makeGeometricEstimator({
    roadFactor: policyRow?.roadFactor ?? 1.3,
    defaultSpeedKmh: policyRow?.defaultSpeedKmh ?? 25,
    fixedOverheadMinutes: policyRow?.fixedOverheadMinutes ?? 5,
  })

  const gaps: AgendaGap[] = []
  for (const member of staffRows) {
    if (!member.isBookable) continue

    const memberHours = staffHoursRows
      .filter((h) => h.staffId === member.id)
      .map((h) => ({
        weekday: h.weekday,
        opensLocal: h.startsLocal.slice(0, 5),
        closesLocal: h.endsLocal.slice(0, 5),
        effectiveFrom: h.effectiveFrom ?? undefined,
        effectiveTo: h.effectiveTo ?? undefined,
      }))

    const working = intersectIntervalLists(
      businessWindows,
      staffIntervalsForDate(date, memberHours, timezone),
    )
    if (working.length === 0) continue

    const busy: Interval[] = occupying
      .filter((b) => b.staffId === member.id)
      .map((b) => ({ start: b.startsAt, end: b.endsAt }))
    for (const bl of blackoutRows) {
      if (bl.staffId === null || bl.staffId === member.id) {
        busy.push({ start: bl.startsAt, end: bl.endsAt })
      }
    }

    // Only forward-looking gaps are actionable; time already past is not a
    // slot anyone can sell.
    const free = clipIntervals(
      subtractIntervalLists(working, busy),
      now,
      new Date(dayStart.getTime() + 2 * 86_400_000),
    )

    for (const interval of free) {
      const minutes = minutesBetween(interval.start, interval.end)
      // Below the shortest service there is nothing to offer, so it is not a gap.
      const fits = serviceRows
        .filter(
          (svc) =>
            svc.durationMinutes +
              svc.bufferAfterMinutes +
              svc.setupMinutes +
              svc.packdownMinutes <=
            minutes,
        )
        .sort((a, b) => b.durationMinutes - a.durationMinutes)
        .map((svc) => ({ id: svc.id, name: svc.name, durationMinutes: svc.durationMinutes }))

      if (fits.length === 0) continue

      gaps.push({
        kind: 'gap',
        startsAt: interval.start,
        endsAt: interval.end,
        minutes,
        staffName: member.name,
        fits,
      })
    }
  }

  // ── Bookings, with the drive leg to whatever comes next ───────────────
  const bookingEntries: AgendaBooking[] = onThisDate.map((b, index) => {
    let driveToNextMinutes: number | null = null

    if (business.isMobileEnabled && b.lat != null && b.lng != null) {
      const from: LatLng = { lat: b.lat, lng: b.lng }
      const next = onThisDate
        .slice(index + 1)
        .find((n) => n.staffId === b.staffId && (OCCUPYING as readonly string[]).includes(n.status))

      const to: LatLng | null =
        next?.lat != null && next?.lng != null
          ? { lat: next.lat, lng: next.lng }
          : baseLoc?.lat != null && baseLoc?.lng != null
            ? { lat: baseLoc.lat, lng: baseLoc.lng }
            : null

      if (to) driveToNextMinutes = Math.round(estimator(from, to, b.endsAt))
    }

    return {
      kind: 'booking' as const,
      id: b.id,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      durationMinutes: minutesBetween(b.startsAt, b.endsAt),
      status: b.status as AgendaStatus,
      serviceName: b.serviceName,
      priceMinor: b.priceMinor,
      currency: b.currency,
      customerName: [b.customerFirst, b.customerLast].filter(Boolean).join(' ') || 'Customer',
      customerPhone: b.customerPhone,
      staffName: b.staffName,
      address: b.line1 ? [b.line1, b.postcode].filter(Boolean).join(', ') : null,
      bookedAgo: b.createdAt,
      source: b.source,
      driveToNextMinutes,
    }
  })

  const entries: AgendaEntry[] = [...bookingEntries, ...gaps].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  )

  // ── Stats strip ───────────────────────────────────────────────────────
  const countable = onThisDate.filter((b) => b.status !== 'cancelled_by_customer' && b.status !== 'cancelled_by_business')
  const upcoming = occupying
    .filter((b) => b.startsAt.getTime() > now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]

  const totalDrive = business.isMobileEnabled
    ? bookingEntries.reduce((sum, e) => sum + (e.driveToNextMinutes ?? 0), 0)
    : null

  return {
    date,
    staffNames: staffRows.map((r) => r.name),
    entries,
    stats: {
      bookingCount: countable.length,
      revenueMinor: countable.reduce((sum, b) => sum + b.priceMinor, 0),
      currency: business.currency,
      next: upcoming
        ? {
            at: upcoming.startsAt,
            customerName: upcoming.customerFirst ?? 'Customer',
            minutesAway: minutesBetween(now, upcoming.startsAt),
          }
        : null,
      freeGapMinutes: gaps.reduce((sum, g) => sum + g.minutes, 0),
      totalDriveMinutes: totalDrive,
    },
  }
}
