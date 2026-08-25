import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'

/** Services grouped by category, preserving the owner's own ordering. */
export async function getServicesByCategory(businessId: string) {
  const rows = await db
    .select()
    .from(s.services)
    .where(eq(s.services.businessId, businessId))
    .orderBy(asc(s.services.sortOrder))

  const categories: { name: string; services: typeof rows }[] = []
  for (const row of rows) {
    const name = row.category ?? 'Services'
    let bucket = categories.find((c) => c.name === name)
    if (!bucket) {
      bucket = { name, services: [] }
      categories.push(bucket)
    }
    bucket.services.push(row)
  }
  return categories
}

export async function getStaffList(businessId: string) {
  const members = await db
    .select()
    .from(s.staff)
    .where(eq(s.staff.businessId, businessId))
    .orderBy(asc(s.staff.sortOrder))

  const hours = await db
    .select()
    .from(s.staffHours)
    .innerJoin(s.staff, eq(s.staff.id, s.staffHours.staffId))
    .where(eq(s.staff.businessId, businessId))

  return members.map((member) => ({
    ...member,
    hours: hours
      .filter((h) => h.staff_hours.staffId === member.id)
      .map((h) => ({
        weekday: h.staff_hours.weekday,
        opensLocal: h.staff_hours.startsLocal.slice(0, 5),
        closesLocal: h.staff_hours.endsLocal.slice(0, 5),
      })),
  }))
}

/**
 * The business's customer list.
 *
 * ENFORCEMENT POINT: this reads `business_customer`, joined to `customer` only
 * for contact details. A customer's bookings at OTHER Localli businesses are
 * never surfaced here, and the constraint lives in the query rather than the
 * serialiser. See planning/12-dashboard-spec.md, Screen 4.
 */
export async function getCustomerList(businessId: string) {
  return db
    .select({
      customerId: s.businessCustomers.customerId,
      displayName: s.businessCustomers.displayName,
      totalBookings: s.businessCustomers.totalBookings,
      totalSpendMinor: s.businessCustomers.totalSpendMinor,
      lastBookedAt: s.businessCustomers.lastBookedAt,
      firstBookedAt: s.businessCustomers.firstBookedAt,
      tags: s.businessCustomers.tags,
      firstName: s.customers.firstName,
      lastName: s.customers.lastName,
      phone: s.customers.phone,
      email: s.customers.email,
    })
    .from(s.businessCustomers)
    .innerJoin(s.customers, eq(s.customers.id, s.businessCustomers.customerId))
    .where(
      and(
        eq(s.businessCustomers.businessId, businessId),
        eq(s.businessCustomers.isBlocked, false),
      ),
    )
    .orderBy(desc(s.businessCustomers.lastBookedAt))
    .limit(200)
}

export async function getBusinessSettings(businessId: string) {
  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) })
  if (!business) return null

  const [hours, address] = await Promise.all([
    db
      .select()
      .from(s.businessHours)
      .where(eq(s.businessHours.businessId, businessId))
      .orderBy(asc(s.businessHours.weekday)),
    business.addressLocationId
      ? db.query.locations.findFirst({ where: eq(s.locations.id, business.addressLocationId) })
      : Promise.resolve(undefined),
  ])

  return {
    business,
    address: address ?? null,
    hours: hours.map((h) => ({
      weekday: h.weekday,
      opensLocal: h.opensLocal.slice(0, 5),
      closesLocal: h.closesLocal.slice(0, 5),
    })),
  }
}
