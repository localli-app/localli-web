import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'
import { AppError } from '../errors'

/** Statuses a business can move a booking to from the dashboard. */
export type BusinessTransition = 'completed' | 'no_show' | 'in_progress' | 'cancelled_by_business'

const TERMINAL = new Set([
  'completed',
  'no_show',
  'cancelled_by_customer',
  'cancelled_by_business',
])

/**
 * Applies a status change and writes the audit row in the SAME transaction.
 *
 * Non-negotiable: every booking status change writes a `booking_event`, with no
 * exceptions — automated transitions included. Doing both here, atomically, is
 * what makes that true rather than aspirational.
 *
 * `businessId` comes from the session. A booking id belonging to another tenant
 * simply will not match, so it 404s rather than leaking that it exists.
 */
export async function transitionBooking(input: {
  businessId: string
  bookingId: string
  to: BusinessTransition
  actorStaffId: string
  note?: string
}): Promise<{ id: string; status: BusinessTransition }> {
  const { businessId, bookingId, to, actorStaffId } = input

  return db.transaction(async (tx) => {
    const booking = await tx.query.bookings.findFirst({
      where: and(eq(s.bookings.id, bookingId), eq(s.bookings.businessId, businessId)),
    })
    if (!booking) throw new AppError('NOT_FOUND', 'Booking not found.')

    if (booking.status === to) {
      return { id: booking.id, status: to }
    }
    if (TERMINAL.has(booking.status)) {
      throw new AppError(
        'VALIDATION_FAILED',
        `That booking is already ${booking.status.replace(/_/g, ' ')}.`,
      )
    }

    await tx
      .update(s.bookings)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(s.bookings.id, bookingId), eq(s.bookings.businessId, businessId)))

    await tx.insert(s.bookingEvents).values({
      bookingId,
      fromStatus: booking.status,
      toStatus: to,
      actorType: 'staff',
      actorId: actorStaffId,
      payload: input.note ? { note: input.note } : null,
    })

    // Completion is the most commercially important event in the system: it is
    // what triggers the receipt, and the receipt is what turns a guest booking
    // into a customer identity. The job that sends it is Wednesday's work
    // (planning/09-api-spec.md, `booking.receipt`); the transition it keys off
    // is recorded correctly here already.

    return { id: booking.id, status: to }
  })
}
