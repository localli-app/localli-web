import { and, asc, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'

export type BookingsTab = 'upcoming' | 'past' | 'cancelled'

const CANCELLED_STATUSES = ['cancelled_by_customer', 'cancelled_by_business'] as const

export interface BookingRow {
  id: string
  startsAt: Date
  endsAt: Date
  status: string
  serviceName: string
  staffName: string
  customerName: string
  customerPhone: string | null
  customerId: string
  source: string
  priceMinor: number
  currency: string
  address: string | null
  createdAt: Date
  customerNote: string | null
}

export interface BookingsListResult {
  rows: BookingRow[]
  totalCount: number
  totalValueMinor: number
  currency: string
}

/**
 * The list view — past, present and future, which is what a calendar is bad at.
 *
 * `businessId` MUST come from the session. Every filter below narrows within
 * that tenant; none of them can widen beyond it.
 */
export async function getBookingsList(input: {
  businessId: string
  tab: BookingsTab
  now: Date
  staffId?: string | null
  source?: string | null
  status?: string | null
  limit?: number
}): Promise<BookingsListResult> {
  const { businessId, tab, now } = input
  const limit = input.limit ?? 100

  const tabCondition =
    tab === 'upcoming'
      ? and(
          gte(s.bookings.startsAt, now),
          inArray(s.bookings.status, ['confirmed', 'in_progress', 'pending_payment']),
        )
      : tab === 'past'
        ? and(
            lt(s.bookings.startsAt, now),
            inArray(s.bookings.status, ['confirmed', 'in_progress', 'completed', 'no_show']),
          )
        : inArray(s.bookings.status, [...CANCELLED_STATUSES])

  const where = and(
    eq(s.bookings.businessId, businessId),
    tabCondition,
    ...(input.staffId ? [eq(s.bookings.staffId, input.staffId)] : []),
    ...(input.source ? [eq(s.bookings.source, input.source as 'gmb')] : []),
    ...(input.status ? [eq(s.bookings.status, input.status as 'confirmed')] : []),
  )

  const rows = await db
    .select({
      id: s.bookings.id,
      startsAt: s.bookings.startsAt,
      endsAt: s.bookings.endsAt,
      status: s.bookings.status,
      priceMinor: s.bookings.priceMinor,
      currency: s.bookings.currency,
      source: s.bookings.source,
      createdAt: s.bookings.createdAt,
      customerNote: s.bookings.customerNote,
      serviceName: s.services.name,
      staffName: s.staff.name,
      customerId: s.customers.id,
      customerFirst: s.customers.firstName,
      customerLast: s.customers.lastName,
      customerPhone: s.customers.phone,
      line1: s.locations.line1,
      postcode: s.locations.postcode,
    })
    .from(s.bookings)
    .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
    .innerJoin(s.staff, eq(s.staff.id, s.bookings.staffId))
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .leftJoin(s.locations, eq(s.locations.id, s.bookings.serviceLocationId))
    .where(where)
    .orderBy(tab === 'past' ? desc(s.bookings.startsAt) : asc(s.bookings.startsAt))
    .limit(limit)

  const mapped: BookingRow[] = rows.map((r) => ({
    id: r.id,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    serviceName: r.serviceName,
    staffName: r.staffName,
    customerId: r.customerId,
    customerName: [r.customerFirst, r.customerLast].filter(Boolean).join(' ') || 'Customer',
    customerPhone: r.customerPhone,
    source: r.source,
    priceMinor: r.priceMinor,
    currency: r.currency,
    address: r.line1 ? [r.line1, r.postcode].filter(Boolean).join(', ') : null,
    createdAt: r.createdAt,
    customerNote: r.customerNote,
  }))

  return {
    rows: mapped,
    totalCount: mapped.length,
    totalValueMinor: mapped.reduce((sum, r) => sum + r.priceMinor, 0),
    currency: mapped[0]?.currency ?? 'GBP',
  }
}

export interface SourceCount {
  source: string
  label: string
  count: number
}

const SOURCE_LABELS: Record<string, string> = {
  gmb: 'Google',
  qr: 'QR code',
  ig: 'Instagram',
  web: 'Your website',
  sms: 'SMS',
  direct: 'Direct',
  manual: 'Added by you',
  marketplace: 'Marketplace',
}

/**
 * Bookings by source. This is the differentiated number: Google does not report
 * performance for custom booking links, so it is one only Localli can hand the
 * business. See planning/04-scope-and-mvp.md.
 */
export async function getBookingsBySource(input: {
  businessId: string
  /** Rolling window, counted back from now. Resolved here rather than in the
   *  component, so the page stays a pure render. */
  withinDays: number
}): Promise<SourceCount[]> {
  const since = new Date(Date.now() - input.withinDays * 86_400_000)

  const rows = await db
    .select({ source: s.bookings.source, n: count() })
    .from(s.bookings)
    .where(and(eq(s.bookings.businessId, input.businessId), gte(s.bookings.createdAt, since)))
    .groupBy(s.bookings.source)
    .orderBy(desc(count()))

  return rows.map((r) => ({
    source: r.source,
    label: SOURCE_LABELS[r.source] ?? r.source,
    count: Number(r.n),
  }))
}

/** Count of bookings needing attention, for the nav badge. */
export async function getAttentionCount(businessId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(s.bookings)
    .where(
      and(
        eq(s.bookings.businessId, businessId),
        eq(s.bookings.status, 'pending_payment'),
        gte(s.bookings.startsAt, sql`now()`),
      ),
    )
  return Number(row?.n ?? 0)
}
