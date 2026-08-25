import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'
import { AppError } from '../errors'
import { hashToken } from './create'

/**
 * Cancel and reschedule from any confirmation, reminder or receipt link, with
 * no login. The access token is the capability; only its hash is stored.
 */

export interface ManagedBooking {
  id: string
  status: string
  startsAt: Date
  endsAt: Date
  timezone: string
  serviceName: string
  staffName: string
  businessName: string
  businessSlug: string
  businessPhone: string | null
  priceMinor: number
  currency: string
  serviceAddress: string | null
  cancellationWindowHours: number
  canCancel: boolean
  canReschedule: boolean
  /** Non-zero when cancelling now falls outside the policy window. */
  lateCancellationFeeMinor: number
}

const TERMINAL = new Set([
  'completed',
  'no_show',
  'cancelled_by_customer',
  'cancelled_by_business',
])

export async function getBookingByAccessToken(
  accessToken: string,
  now = new Date(),
): Promise<ManagedBooking | null> {
  const row = await db.query.bookings.findFirst({
    where: eq(s.bookings.accessTokenHash, hashToken(accessToken)),
  })
  if (!row) return null

  const [service, staffMember, business] = await Promise.all([
    db.query.services.findFirst({ where: eq(s.services.id, row.serviceId) }),
    db.query.staff.findFirst({ where: eq(s.staff.id, row.staffId) }),
    db.query.businesses.findFirst({ where: eq(s.businesses.id, row.businessId) }),
  ])
  const location = row.serviceLocationId
    ? await db.query.locations.findFirst({ where: eq(s.locations.id, row.serviceLocationId) })
    : null

  // The policy in force when they booked, not today's policy.
  const windowHours = row.policySnapshot.cancellationWindowHours
  const hoursUntil = (row.startsAt.getTime() - now.getTime()) / 3_600_000
  const isTerminal = TERMINAL.has(row.status)
  const insideWindow = hoursUntil >= windowHours

  return {
    id: row.id,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: business?.timezone ?? 'Europe/London',
    serviceName: service?.name ?? '',
    staffName: staffMember?.name ?? '',
    businessName: business?.name ?? '',
    businessSlug: business?.slug ?? '',
    businessPhone: business?.phone ?? null,
    priceMinor: row.priceMinor,
    currency: row.currency,
    serviceAddress: location
      ? [location.line1, location.postcode].filter(Boolean).join(', ')
      : null,
    cancellationWindowHours: windowHours,
    canCancel: !isTerminal && hoursUntil > 0,
    canReschedule: !isTerminal && hoursUntil > 0,
    lateCancellationFeeMinor: insideWindow ? 0 : row.policySnapshot.noShowFeeMinor,
  }
}

export async function cancelBooking(
  accessToken: string,
  reason: string | null,
  now = new Date(),
): Promise<{ status: string; feeApplied: { amountMinor: number; currency: string } }> {
  const booking = await getBookingByAccessToken(accessToken, now)
  if (!booking) throw new AppError('INVALID_TOKEN', 'Booking not found.')
  if (!booking.canCancel) {
    throw new AppError('POLICY_WINDOW_PASSED', 'This booking can no longer be cancelled online.')
  }

  await db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ status: s.bookings.status })
      .from(s.bookings)
      .where(eq(s.bookings.id, booking.id))

    await tx
      .update(s.bookings)
      .set({ status: 'cancelled_by_customer', updatedAt: now })
      .where(eq(s.bookings.id, booking.id))

    // No status change without a booking_event. No exceptions.
    await tx.insert(s.bookingEvents).values({
      bookingId: booking.id,
      fromStatus: previous?.status ?? null,
      toStatus: 'cancelled_by_customer',
      actorType: 'customer',
      payload: {
        reason,
        // Outside the window we still allow the cancellation, but record the
        // fee that applies so the business can act on it.
        feeMinor: booking.lateCancellationFeeMinor,
        appliedPolicy: { cancellationWindowHours: booking.cancellationWindowHours },
      },
    })
  })

  return {
    status: 'cancelled_by_customer',
    feeApplied: { amountMinor: booking.lateCancellationFeeMinor, currency: booking.currency },
  }
}

/** RFC 5545 escaping for text values. */
function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function icsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function buildIcs(booking: ManagedBooking, manageUrl: string): string {
  const location = booking.serviceAddress ?? booking.businessName
  const description = [
    `${booking.serviceName} with ${booking.staffName}`,
    booking.businessPhone ? `Call ${booking.businessName}: ${booking.businessPhone}` : null,
    `Manage this booking: ${manageUrl}`,
  ]
    .filter(Boolean)
    .join('\\n')

  // CRLF line endings are required by the spec; some clients reject LF-only.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Localli//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@localli.app`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(booking.startsAt)}`,
    `DTEND:${icsStamp(booking.endsAt)}`,
    `SUMMARY:${icsEscape(`${booking.serviceName} — ${booking.businessName}`)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(`${booking.serviceName} at ${booking.businessName} in 1 hour`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
