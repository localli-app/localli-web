import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from './client'
import * as s from './schema'
import type { BookingSettings } from './schema'
import type {
  BlackoutInput,
  BookingInput,
  ServiceAreaInput,
  StaffInput,
  TravelPolicyInput,
  WeeklyHours,
} from '../availability'

/** Statuses that occupy the calendar. Mirrors the partial EXCLUDE constraint. */
const OCCUPYING = ['confirmed', 'in_progress'] as const

export interface PublicService {
  id: string
  name: string
  description: string | null
  category: string | null
  durationMinutes: number
  priceMinor: number
  currency: string
  depositPercent: number
}

export interface PublicBusiness {
  id: string
  slug: string
  name: string
  description: string | null
  timezone: string
  currency: string
  phone: string | null
  logoUrl: string | null
  photos: string[]
  isMobile: boolean
  address: { line1: string; city: string | null; postcode: string | null } | null
  hours: WeeklyHours[]
  settings: BookingSettings
  categories: { name: string; services: PublicService[] }[]
  staff: { id: string; name: string; avatarUrl: string | null; bio: string | null }[]
}

/**
 * Everything the landing page needs, in one round trip per table.
 * Only active services and bookable staff are exposed.
 */
export async function getPublicBusinessBySlug(slug: string): Promise<PublicBusiness | null> {
  const business = await db.query.businesses.findFirst({
    where: eq(s.businesses.slug, slug),
  })
  if (!business) return null

  const [hours, serviceRows, staffRows, address] = await Promise.all([
    db
      .select()
      .from(s.businessHours)
      .where(eq(s.businessHours.businessId, business.id))
      .orderBy(asc(s.businessHours.weekday)),
    db
      .select()
      .from(s.services)
      .where(and(eq(s.services.businessId, business.id), eq(s.services.isActive, true)))
      .orderBy(asc(s.services.sortOrder)),
    db
      .select()
      .from(s.staff)
      .where(
        and(
          eq(s.staff.businessId, business.id),
          eq(s.staff.isActive, true),
          eq(s.staff.isBookable, true),
        ),
      )
      .orderBy(asc(s.staff.sortOrder)),
    business.addressLocationId
      ? db.query.locations.findFirst({ where: eq(s.locations.id, business.addressLocationId) })
      : Promise.resolve(undefined),
  ])

  // Preserve the sortOrder-derived category order rather than alphabetising.
  const categories: { name: string; services: PublicService[] }[] = []
  for (const row of serviceRows) {
    const name = row.category ?? 'Services'
    let bucket = categories.find((c) => c.name === name)
    if (!bucket) {
      bucket = { name, services: [] }
      categories.push(bucket)
    }
    bucket.services.push({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      durationMinutes: row.durationMinutes,
      priceMinor: row.priceMinor,
      currency: business.currency,
      depositPercent: row.depositPercent,
    })
  }

  return {
    id: business.id,
    slug: business.slug,
    name: business.name,
    description: business.description,
    timezone: business.timezone,
    currency: business.currency,
    phone: business.phone,
    logoUrl: business.logoUrl,
    photos: business.photos ?? [],
    isMobile: business.isMobileEnabled,
    address: address
      ? { line1: address.line1, city: address.city, postcode: address.postcode }
      : null,
    hours: hours.map((h) => ({
      weekday: h.weekday,
      // `time` columns come back as HH:mm:ss; the engine wants HH:mm.
      opensLocal: h.opensLocal.slice(0, 5),
      closesLocal: h.closesLocal.slice(0, 5),
    })),
    settings: business.bookingSettings,
    categories,
    staff: staffRows.map((st) => ({
      id: st.id,
      name: st.name,
      avatarUrl: st.avatarUrl,
      bio: st.bio,
    })),
  }
}

export interface SlotSnapshot {
  business: {
    id: string
    timezone: string
    currency: string
    settings: BookingSettings
    isMobile: boolean
  }
  service: {
    id: string
    name: string
    durationMinutes: number
    bufferAfterMinutes: number
    setupMinutes: number
    packdownMinutes: number
    priceMinor: number
  }
  businessHours: WeeklyHours[]
  staff: StaffInput[]
  staffNames: Map<string, string>
  bookings: BookingInput[]
  blackouts: BlackoutInput[]
  serviceAreas: ServiceAreaInput[]
  travelPolicy: TravelPolicyInput
  /** Per-business constants for the Stage 1 geometric travel estimator. */
  travelEstimatorConfig: {
    roadFactor: number
    defaultSpeedKmh: number
    fixedOverheadMinutes: number
  }
}

/**
 * Loads the snapshot the pure availability engine consumes. All I/O lives here
 * so `lib/availability` stays free of it.
 *
 * `windowStart`/`windowEnd` bound the booking and blackout query; pass a range
 * generously wider than the dates being computed so a booking that starts the
 * previous evening still trims the morning correctly.
 */
export async function loadSlotSnapshot(input: {
  businessId: string
  serviceId: string
  staffId?: string | null
  windowStart: Date
  windowEnd: Date
}): Promise<SlotSnapshot | null> {
  const { businessId, serviceId, staffId, windowStart, windowEnd } = input

  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) })
  if (!business) return null

  // Scoped by businessId as well as id: a service id from another tenant must not resolve.
  const service = await db.query.services.findFirst({
    where: and(
      eq(s.services.id, serviceId),
      eq(s.services.businessId, businessId),
      eq(s.services.isActive, true),
    ),
  })
  if (!service) return null

  // Eligible staff = active, bookable, and linked to this service.
  const eligible = await db
    .select({
      id: s.staff.id,
      name: s.staff.name,
    })
    .from(s.staff)
    .innerJoin(s.serviceStaff, eq(s.serviceStaff.staffId, s.staff.id))
    .where(
      and(
        eq(s.staff.businessId, businessId),
        eq(s.staff.isActive, true),
        eq(s.staff.isBookable, true),
        eq(s.serviceStaff.serviceId, serviceId),
        ...(staffId ? [eq(s.staff.id, staffId)] : []),
      ),
    )
    .orderBy(asc(s.staff.sortOrder))

  if (eligible.length === 0) return null
  const staffIds = eligible.map((e) => e.id)

  const [hoursRows, staffHoursRows, bookingRows, blackoutRows, areaRows, policyRow, baseLocation] =
    await Promise.all([
      db.select().from(s.businessHours).where(eq(s.businessHours.businessId, businessId)),
      db.select().from(s.staffHours).where(inArray(s.staffHours.staffId, staffIds)),
      db
        .select({
          staffId: s.bookings.staffId,
          startsAt: s.bookings.startsAt,
          endsAt: s.bookings.endsAt,
          travelInMinutes: s.bookings.travelInMinutes,
          travelOutMinutes: s.bookings.travelOutMinutes,
          lat: s.locations.lat,
          lng: s.locations.lng,
        })
        .from(s.bookings)
        .leftJoin(s.locations, eq(s.locations.id, s.bookings.serviceLocationId))
        .where(
          and(
            eq(s.bookings.businessId, businessId),
            inArray(s.bookings.staffId, staffIds),
            inArray(s.bookings.status, [...OCCUPYING]),
            lte(s.bookings.startsAt, windowEnd),
            gte(s.bookings.endsAt, windowStart),
          ),
        ),
      db
        .select()
        .from(s.blackouts)
        .where(
          and(
            eq(s.blackouts.businessId, businessId),
            lte(s.blackouts.startsAt, windowEnd),
            gte(s.blackouts.endsAt, windowStart),
          ),
        ),
      db
        .select({
          staffId: s.serviceAreas.staffId,
          radiusMetres: s.serviceAreas.radiusMetres,
          lat: sql<number>`ST_Y(${s.serviceAreas.centreGeog}::geometry)`,
          lng: sql<number>`ST_X(${s.serviceAreas.centreGeog}::geometry)`,
        })
        .from(s.serviceAreas)
        .where(and(eq(s.serviceAreas.businessId, businessId), eq(s.serviceAreas.kind, 'radius'))),
      db.query.travelPolicies.findFirst({ where: eq(s.travelPolicies.businessId, businessId) }),
      business.addressLocationId
        ? db.query.locations.findFirst({ where: eq(s.locations.id, business.addressLocationId) })
        : Promise.resolve(undefined),
    ])

  const base =
    baseLocation?.lat != null && baseLocation?.lng != null
      ? { lat: baseLocation.lat, lng: baseLocation.lng }
      : undefined

  const staffHoursByStaff = new Map<string, typeof staffHoursRows>()
  for (const row of staffHoursRows) {
    const list = staffHoursByStaff.get(row.staffId) ?? []
    list.push(row)
    staffHoursByStaff.set(row.staffId, list)
  }

  return {
    business: {
      id: business.id,
      timezone: business.timezone,
      currency: business.currency,
      settings: business.bookingSettings,
      isMobile: business.isMobileEnabled,
    },
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
      setupMinutes: service.setupMinutes,
      packdownMinutes: service.packdownMinutes,
      priceMinor: service.priceMinor,
    },
    businessHours: hoursRows.map((h) => ({
      weekday: h.weekday,
      opensLocal: h.opensLocal.slice(0, 5),
      closesLocal: h.closesLocal.slice(0, 5),
    })),
    staff: eligible.map((e) => ({
      id: e.id,
      baseLocation: base,
      hours: (staffHoursByStaff.get(e.id) ?? []).map((h) => ({
        weekday: h.weekday,
        opensLocal: h.startsLocal.slice(0, 5),
        closesLocal: h.endsLocal.slice(0, 5),
        effectiveFrom: h.effectiveFrom ?? undefined,
        effectiveTo: h.effectiveTo ?? undefined,
      })),
    })),
    staffNames: new Map(eligible.map((e) => [e.id, e.name])),
    bookings: bookingRows.map((b) => ({
      staffId: b.staffId,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      location: b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : undefined,
      travelInMinutes: b.travelInMinutes ?? undefined,
      travelOutMinutes: b.travelOutMinutes ?? undefined,
    })),
    blackouts: blackoutRows.map((b) => ({
      staffId: b.staffId,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
    })),
    serviceAreas: areaRows
      .filter((a) => a.radiusMetres != null)
      .map((a) => ({
        staffId: a.staffId,
        centre: { lat: Number(a.lat), lng: Number(a.lng) },
        radiusMetres: a.radiusMetres!,
      })),
    travelPolicy: {
      maxLegMinutes: policyRow?.maxLegMinutes ?? 45,
      maxDailyDriveMinutes: policyRow?.maxDailyDriveMinutes ?? 180,
    },
    travelEstimatorConfig: {
      roadFactor: policyRow?.roadFactor ?? 1.3,
      defaultSpeedKmh: policyRow?.defaultSpeedKmh ?? 25,
      fixedOverheadMinutes: policyRow?.fixedOverheadMinutes ?? 5,
    },
  }
}

