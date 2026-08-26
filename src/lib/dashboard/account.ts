import { asc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'

/**
 * Data export and account deletion.
 *
 * The promise in planning/01-product-brief.md is that a business can export
 * everything about their relationship with a customer. What they cannot export
 * is the fact that the same person also books somewhere else — that was never
 * theirs. Both halves of that are enforced here, in the queries.
 */

/**
 * Everything this business owns, as a plain object ready to serialise.
 *
 * ENFORCEMENT POINT: customer rows are projected through `business_customer`,
 * so only the contact details and history belonging to THIS business are
 * included. No booking from another business can appear, because every query
 * below is filtered by businessId.
 */
export async function exportBusinessData(businessId: string) {
  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) })
  if (!business) return null

  const [hours, staffRows, staffHourRows, serviceRows, serviceStaffRows, areas, policy, address] =
    await Promise.all([
      db.select().from(s.businessHours).where(eq(s.businessHours.businessId, businessId)),
      db.select().from(s.staff).where(eq(s.staff.businessId, businessId)).orderBy(asc(s.staff.sortOrder)),
      db
        .select({
          staffId: s.staffHours.staffId,
          weekday: s.staffHours.weekday,
          startsLocal: s.staffHours.startsLocal,
          endsLocal: s.staffHours.endsLocal,
        })
        .from(s.staffHours)
        .innerJoin(s.staff, eq(s.staff.id, s.staffHours.staffId))
        .where(eq(s.staff.businessId, businessId)),
      db.select().from(s.services).where(eq(s.services.businessId, businessId)),
      db
        .select({ serviceId: s.serviceStaff.serviceId, staffId: s.serviceStaff.staffId })
        .from(s.serviceStaff)
        .innerJoin(s.services, eq(s.services.id, s.serviceStaff.serviceId))
        .where(eq(s.services.businessId, businessId)),
      db.select().from(s.serviceAreas).where(eq(s.serviceAreas.businessId, businessId)),
      db.query.travelPolicies.findFirst({ where: eq(s.travelPolicies.businessId, businessId) }),
      db.query.businesses
        .findFirst({ where: eq(s.businesses.id, businessId) })
        .then((b) =>
          b?.addressLocationId
            ? db.query.locations.findFirst({ where: eq(s.locations.id, b.addressLocationId) })
            : null,
        ),
    ])

  const customers = await db
    .select({
      customerId: s.businessCustomers.customerId,
      displayName: s.businessCustomers.displayName,
      notes: s.businessCustomers.notes,
      tags: s.businessCustomers.tags,
      firstBookedAt: s.businessCustomers.firstBookedAt,
      lastBookedAt: s.businessCustomers.lastBookedAt,
      totalBookings: s.businessCustomers.totalBookings,
      totalSpendMinor: s.businessCustomers.totalSpendMinor,
      marketingConsent: s.businessCustomers.marketingConsent,
      firstName: s.customers.firstName,
      lastName: s.customers.lastName,
      email: s.customers.email,
      phone: s.customers.phone,
    })
    .from(s.businessCustomers)
    .innerJoin(s.customers, eq(s.customers.id, s.businessCustomers.customerId))
    .where(eq(s.businessCustomers.businessId, businessId))

  const bookings = await db
    .select({
      id: s.bookings.id,
      startsAt: s.bookings.startsAt,
      endsAt: s.bookings.endsAt,
      status: s.bookings.status,
      priceMinor: s.bookings.priceMinor,
      currency: s.bookings.currency,
      source: s.bookings.source,
      sourceDetail: s.bookings.sourceDetail,
      customerNote: s.bookings.customerNote,
      staffNote: s.bookings.staffNote,
      createdAt: s.bookings.createdAt,
      serviceName: s.services.name,
      staffName: s.staff.name,
      customerId: s.bookings.customerId,
    })
    .from(s.bookings)
    .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
    .innerJoin(s.staff, eq(s.staff.id, s.bookings.staffId))
    .where(eq(s.bookings.businessId, businessId))
    .orderBy(asc(s.bookings.startsAt))

  return {
    exportedAt: new Date().toISOString(),
    note: 'Contains only data belonging to this business. A customer’s bookings at other Localli businesses are not included, and are not this business’s data.',
    business: {
      slug: business.slug,
      name: business.name,
      description: business.description,
      timezone: business.timezone,
      currency: business.currency,
      phone: business.phone,
      email: business.email,
      isMobileEnabled: business.isMobileEnabled,
      bookingSettings: business.bookingSettings,
      createdAt: business.createdAt,
      address: address
        ? {
            line1: address.line1,
            city: address.city,
            postcode: address.postcode,
            country: address.country,
          }
        : null,
    },
    openingHours: hours.map((h) => ({
      weekday: h.weekday,
      opensLocal: h.opensLocal,
      closesLocal: h.closesLocal,
    })),
    staff: staffRows.map((member) => ({
      name: member.name,
      email: member.email,
      role: member.role,
      isBookable: member.isBookable,
      isActive: member.isActive,
      hours: staffHourRows
        .filter((h) => h.staffId === member.id)
        .map((h) => ({ weekday: h.weekday, startsLocal: h.startsLocal, endsLocal: h.endsLocal })),
    })),
    services: serviceRows.map((service) => ({
      name: service.name,
      category: service.category,
      durationMinutes: service.durationMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
      setupMinutes: service.setupMinutes,
      packdownMinutes: service.packdownMinutes,
      priceMinor: service.priceMinor,
      currency: business.currency,
      isActive: service.isActive,
      staffCount: serviceStaffRows.filter((r) => r.serviceId === service.id).length,
    })),
    serviceAreas: areas.map((a) => ({ label: a.label, kind: a.kind, radiusMetres: a.radiusMetres })),
    travelPolicy: policy
      ? {
          maxLegMinutes: policy.maxLegMinutes,
          maxDailyDriveMinutes: policy.maxDailyDriveMinutes,
          roadFactor: policy.roadFactor,
          defaultSpeedKmh: policy.defaultSpeedKmh,
          fixedOverheadMinutes: policy.fixedOverheadMinutes,
        }
      : null,
    customers,
    bookings,
  }
}

/** The customer list as CSV, which is what owners actually want to open. */
export function customersToCsv(
  customers: Awaited<ReturnType<typeof exportBusinessData>> extends null
    ? never
    : NonNullable<Awaited<ReturnType<typeof exportBusinessData>>>['customers'],
): string {
  const header = [
    'first_name',
    'last_name',
    'display_name',
    'email',
    'phone',
    'total_bookings',
    'total_spend_minor',
    'first_booked_at',
    'last_booked_at',
    'marketing_consent',
    'notes',
  ]

  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    const text = String(value)
    // Quote anything a spreadsheet would otherwise misread.
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const rows = customers.map((c) =>
    [
      c.firstName,
      c.lastName,
      c.displayName,
      c.email,
      c.phone,
      c.totalBookings,
      c.totalSpendMinor,
      c.firstBookedAt?.toISOString() ?? '',
      c.lastBookedAt?.toISOString() ?? '',
      c.marketingConsent,
      c.notes,
    ]
      .map(escape)
      .join(','),
  )

  return [header.join(','), ...rows].join('\n')
}

/**
 * Permanently deletes a business and everything hanging off it.
 *
 * Customers are NOT deleted: `customer` is global, and the same person very
 * likely books elsewhere on Localli. Removing them here would corrupt another
 * business's history. The join row in `business_customer` — which is this
 * business's own view of them — cascades away with the business, which is
 * exactly the right boundary.
 */
export async function deleteBusinessAccount(businessId: string): Promise<void> {
  await db.delete(s.businesses).where(eq(s.businesses.id, businessId))
}
