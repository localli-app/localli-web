import { createHash, randomBytes } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'
import type { PolicySnapshot } from '../db/schema'
import { getPublicBusinessBySlug, loadSlotSnapshot } from '../db/queries'
import { resolveCustomer } from '../identity/resolve'
import { AppError } from '../errors'
import { computeSlots, nextAvailable } from './slots'
import { localDateOf } from '../format'
import { checkTravelFeasibility, isInServiceArea } from '../availability'
import { makeGeometricEstimator } from '../travel/estimate'
import type { CreateBookingInput } from '../validation/booking'

/** Postgres exclusion_violation. The database, not application logic, prevents double booking. */
const SQLSTATE_EXCLUSION_VIOLATION = '23P01'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function newAccessToken(): string {
  return randomBytes(24).toString('base64url')
}

export interface CreatedBooking {
  id: string
  accessToken: string
  startsAt: string
  endsAt: string
  service: { name: string; durationMinutes: number }
  staff: { name: string }
  business: { name: string; phone: string | null; address: { line1: string } | null }
  price: { amountMinor: number; currency: string }
  manageUrl: string
  icsUrl: string
}

export async function createBooking(
  input: CreateBookingInput,
  opts: { idempotencyKey: string; appUrl: string; now?: Date },
): Promise<{ booking: CreatedBooking; reused: boolean; deviceToken: string }> {
  const now = opts.now ?? new Date()

  const business = await getPublicBusinessBySlug(input.businessSlug)
  if (!business) throw new AppError('BUSINESS_INACTIVE', 'That business is not taking bookings.')

  // Step 2: idempotency. A double-tapped submit on a slow connection must not
  // produce two appointments.
  const existing = await db.query.bookings.findFirst({
    where: and(
      eq(s.bookings.businessId, business.id),
      eq(s.bookings.idempotencyKey, opts.idempotencyKey),
    ),
  })
  if (existing) {
    return {
      booking: await presentBooking(existing.id, opts.appUrl, null),
      reused: true,
      deviceToken: input.deviceToken ?? '',
    }
  }

  if (business.isMobile && !input.serviceAddress) {
    throw new AppError('VALIDATION_FAILED', 'An address is required for a mobile booking.')
  }
  if (business.settings.requireLastName && !input.customer.lastName) {
    throw new AppError('VALIDATION_FAILED', 'A last name is required.')
  }

  const destination = input.serviceAddress
    ? { lat: input.serviceAddress.lat, lng: input.serviceAddress.lng }
    : null

  const snapshot = await loadSlotSnapshot({
    businessId: business.id,
    serviceId: input.serviceId,
    staffId: input.staffId,
    windowStart: new Date(now.getTime() - 2 * 86_400_000),
    windowEnd: new Date(new Date(input.startsAt).getTime() + 2 * 86_400_000),
  })
  if (!snapshot) throw new AppError('NOT_FOUND', 'That service is not available.')

  const startsAt = new Date(input.startsAt)
  const totalMinutes =
    snapshot.service.durationMinutes +
    snapshot.service.bufferAfterMinutes +
    snapshot.service.setupMinutes +
    snapshot.service.packdownMinutes
  const endsAt = new Date(startsAt.getTime() + totalMinutes * 60_000)

  // Step 5 (mobile): area check before anything expensive.
  if (business.isMobile && destination) {
    const eligibleIds = snapshot.staff.map((st) => st.id)
    if (!isInServiceArea(destination, snapshot.serviceAreas, eligibleIds)) {
      await db.insert(s.outOfAreaRequests).values({
        businessId: business.id,
        serviceId: input.serviceId,
        lat: destination.lat,
        lng: destination.lng,
        postcode: input.serviceAddress?.postcode ?? null,
      })
      throw new AppError('OUT_OF_AREA', `${business.name} doesn't travel to that area yet.`)
    }
  }

  // Step 4: re-run availability for this exact slot. Cheap insurance against a
  // stale client that has been sitting on the time screen for ten minutes.
  const localDate = localDateOf(startsAt, business.timezone)
  const recheck = await computeSlots({
    businessId: business.id,
    serviceId: input.serviceId,
    staffId: input.staffId,
    from: localDate,
    to: localDate,
    destination,
    now,
  })

  const match = recheck.days
    .flatMap((d) => d.slots)
    .find((slot) => new Date(slot.startsAt).getTime() === startsAt.getTime())

  if (!match) {
    throw new AppError('SLOT_TAKEN', 'That time was just booked.', {
      alternatives: await alternativeSlots({
        businessId: business.id,
        serviceId: input.serviceId,
        staffId: input.staffId,
        destination,
        fromDate: localDate,
        now,
      }),
    })
  }

  const assignedStaffId = match.staffId

  // Travel legs for the assigned staff member, recomputed so the stored values
  // reflect what we actually committed to.
  let travelInMinutes: number | null = null
  let travelOutMinutes: number | null = null
  if (business.isMobile && destination) {
    const staffMember = snapshot.staff.find((st) => st.id === assignedStaffId)
    if (staffMember) {
      const sameDay = snapshot.bookings
        .filter(
          (b) => b.staffId === assignedStaffId && localDateOf(b.startsAt, business.timezone) === localDate,
        )
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

      const feasibility = checkTravelFeasibility({
        staff: staffMember,
        candidateStart: startsAt,
        candidateEnd: endsAt,
        window: { start: startsAt, end: endsAt },
        sameDayBookings: sameDay,
        mobile: {
          destination,
          serviceAreas: snapshot.serviceAreas,
          travelPolicy: snapshot.travelPolicy,
          estimate: makeGeometricEstimator(snapshot.travelEstimatorConfig),
        },
      })
      travelInMinutes = Math.round(feasibility.travelInMinutes)
      travelOutMinutes = Math.round(feasibility.travelOutMinutes)
    }
  }

  const accessToken = newAccessToken()
  const deviceToken = input.deviceToken || randomBytes(18).toString('base64url')

  const policySnapshot: PolicySnapshot = {
    cancellationWindowHours: business.settings.cancellationWindowHours,
    depositPercent: 0,
    noShowFeeMinor: 0,
    text: null,
  }

  let bookingId: string
  try {
    bookingId = await db.transaction(async (tx) => {
      // Step 3: resolve the customer inside the transaction.
      const resolved = await resolveCustomer({
        tx: tx as never,
        businessId: business.id,
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        phone: input.customer.phone,
        email: input.customer.email,
        deviceToken,
      })

      let serviceLocationId: string | null = null
      if (input.serviceAddress) {
        const [loc] = await tx
          .insert(s.locations)
          .values({
            line1: input.serviceAddress.line1,
            city: input.serviceAddress.city ?? null,
            postcode: input.serviceAddress.postcode ?? null,
            country: 'GB',
            lat: input.serviceAddress.lat,
            lng: input.serviceAddress.lng,
            accessNotes: input.serviceAddress.accessNotes ?? null,
            geog: sql`ST_SetSRID(ST_MakePoint(${input.serviceAddress.lng}, ${input.serviceAddress.lat}), 4326)::geography` as never,
          })
          .returning({ id: s.locations.id })
        serviceLocationId = loc.id
      }

      // Step 6: insert. No pre-check — that would reintroduce the very race the
      // exclusion constraint exists to remove.
      const [row] = await tx
        .insert(s.bookings)
        .values({
          businessId: business.id,
          staffId: assignedStaffId,
          serviceId: input.serviceId,
          customerId: resolved.customerId,
          startsAt,
          endsAt,
          serviceLocationId,
          travelInMinutes,
          travelOutMinutes,
          status: 'confirmed',
          priceMinor: snapshot.service.priceMinor,
          currency: snapshot.business.currency,
          source: input.source,
          sourceDetail: input.sourceDetail ?? null,
          customerNote: input.note ?? null,
          policySnapshot,
          accessTokenHash: hashToken(accessToken),
          idempotencyKey: opts.idempotencyKey,
        })
        .returning({ id: s.bookings.id })

      // Step 7: the business's own view of this customer.
      await tx
        .insert(s.businessCustomers)
        .values({
          businessId: business.id,
          customerId: resolved.customerId,
          displayName: input.customer.firstName,
          firstBookedAt: now,
          lastBookedAt: now,
          totalBookings: 1,
          totalSpendMinor: 0,
          marketingConsent: input.marketingConsent,
        })
        .onConflictDoUpdate({
          target: [s.businessCustomers.businessId, s.businessCustomers.customerId],
          set: {
            lastBookedAt: now,
            totalBookings: sql`${s.businessCustomers.totalBookings} + 1`,
          },
        })

      // Step 8: no status change without a booking_event. Creation included.
      await tx.insert(s.bookingEvents).values({
        bookingId: row.id,
        fromStatus: null,
        toStatus: 'confirmed',
        actorType: 'customer',
        actorId: resolved.customerId,
        payload: { source: input.source, matchedBy: resolved.matchedBy },
      })

      return row.id
    })
  } catch (e) {
    if ((e as { code?: string }).code === SQLSTATE_EXCLUSION_VIOLATION) {
      throw new AppError('SLOT_TAKEN', 'That time was just booked.', {
        alternatives: await alternativeSlots({
          businessId: business.id,
          serviceId: input.serviceId,
          staffId: input.staffId,
          destination,
          fromDate: localDate,
          now,
        }),
      })
    }
    throw e
  }

  return {
    booking: await presentBooking(bookingId, opts.appUrl, accessToken),
    reused: false,
    deviceToken,
  }
}

/**
 * Two or three nearby times, returned with a 409 so the client can offer a
 * recovery rather than dumping the customer back onto an empty calendar.
 */
async function alternativeSlots(input: {
  businessId: string
  serviceId: string
  staffId?: string | null
  destination: { lat: number; lng: number } | null
  fromDate: string
  now: Date
}) {
  try {
    const { slots } = await nextAvailable({
      businessId: input.businessId,
      serviceId: input.serviceId,
      staffId: input.staffId,
      destination: input.destination,
      fromDate: input.fromDate,
      now: input.now,
      count: 3,
    })
    return slots.map((slot) => ({
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      staffId: slot.staffId,
      staffName: slot.staffName,
    }))
  } catch {
    // A failure to suggest alternatives must never mask the 409 itself.
    return []
  }
}

/** Shared presentation for creation, retrieval, and the manage screen. */
export async function presentBooking(
  bookingId: string,
  appUrl: string,
  accessToken: string | null,
): Promise<CreatedBooking> {
  const row = await db.query.bookings.findFirst({ where: eq(s.bookings.id, bookingId) })
  if (!row) throw new AppError('NOT_FOUND', 'Booking not found.')

  const [service, staffMember, business] = await Promise.all([
    db.query.services.findFirst({ where: eq(s.services.id, row.serviceId) }),
    db.query.staff.findFirst({ where: eq(s.staff.id, row.staffId) }),
    db.query.businesses.findFirst({ where: eq(s.businesses.id, row.businessId) }),
  ])
  const address = business?.addressLocationId
    ? await db.query.locations.findFirst({ where: eq(s.locations.id, business.addressLocationId) })
    : null

  const token = accessToken ?? ''
  return {
    id: row.id,
    accessToken: token,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    service: { name: service?.name ?? '', durationMinutes: service?.durationMinutes ?? 0 },
    staff: { name: staffMember?.name ?? '' },
    business: {
      name: business?.name ?? '',
      phone: business?.phone ?? null,
      address: address ? { line1: address.line1 } : null,
    },
    price: { amountMinor: row.priceMinor, currency: row.currency },
    manageUrl: token ? `${appUrl}/b/${token}` : '',
    icsUrl: token ? `${appUrl}/b/${token}/calendar.ics` : '',
  }
}
