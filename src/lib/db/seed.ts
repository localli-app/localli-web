import 'dotenv/config'
import { createHash } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import postgres from 'postgres'
import * as schema from './schema'
import { defaultBookingSettings } from './schema'

/**
 * Seeds "Glow Studio", the mobile salon from the design canvas
 * ("Localli mobile booking flow"). Services, prices, durations, hours, address
 * and coverage area all come from those artboards.
 *
 * NOTE: this is the design's placeholder business, not the real design partner.
 * Swap in their actual service list and prices before the Friday demo — a demo
 * with their own name on it is worth far more (planning/10-build-order.md).
 *
 * Safe to re-run: it deletes the glow-studio business first, and every child
 * row cascades.
 */

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.')
}

const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })
const db = drizzle(client, { schema })

const SLUG = 'glow-studio'
const TIMEZONE = 'Europe/London'

/** Approximate south-east London coordinates. Good enough for a geometric travel model. */
const PLACES = {
  millLane: { lat: 51.4557, lng: -0.014 }, // 14 Mill Lane, SE13 7HZ — Sam's base
  lewisham: { lat: 51.4626, lng: -0.0116 },
  blackheath: { lat: 51.4665, lng: 0.0079 },
  greenwich: { lat: 51.4826, lng: -0.0077 },
}

async function insertLocation(input: {
  line1: string
  city: string
  postcode: string
  lat: number
  lng: number
}): Promise<string> {
  const [row] = await db
    .insert(schema.locations)
    .values({
      line1: input.line1,
      city: input.city,
      postcode: input.postcode,
      country: 'GB',
      lat: input.lat,
      lng: input.lng,
      // PostGIS point, built in SQL: lng first, then lat.
      geog: sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography` as never,
    })
    .returning({ id: schema.locations.id })
  return row.id
}

async function main() {
  console.log('Seeding Glow Studio...')

  await db.delete(schema.businesses).where(eq(schema.businesses.slug, SLUG))

  const addressId = await insertLocation({
    line1: '14 Mill Lane',
    city: 'London',
    postcode: 'SE13 7HZ',
    ...PLACES.millLane,
  })

  const [business] = await db
    .insert(schema.businesses)
    .values({
      slug: SLUG,
      name: 'Glow Studio',
      description: 'Mobile hair and beauty, South London',
      timezone: TIMEZONE,
      currency: 'GBP',
      addressLocationId: addressId,
      phone: '+442079460100',
      email: 'hello@glowstudio.example',
      isMobileEnabled: true,
      bookingSettings: {
        ...defaultBookingSettings(),
        contactField: 'phone',
        minNoticeMinutes: 120,
        maxAdvanceDays: 60,
        cancellationWindowHours: 24,
      },
    })
    .returning({ id: schema.businesses.id })

  // Tue-Sat 9am-7pm. Closed Sunday (0) and Monday (1), per the landing artboard.
  await db.insert(schema.businessHours).values(
    [2, 3, 4, 5, 6].map((weekday) => ({
      businessId: business.id,
      weekday,
      opensLocal: '09:00',
      closesLocal: '19:00',
    })),
  )

  const [sam] = await db
    .insert(schema.staff)
    .values({
      businessId: business.id,
      name: 'Sam',
      role: 'owner',
      email: 'sam@glowstudio.example',
      isBookable: true,
    })
    .returning({ id: schema.staff.id })

  await db.insert(schema.staffHours).values(
    [2, 3, 4, 5, 6].map((weekday) => ({
      staffId: sam.id,
      weekday,
      startsLocal: '09:00',
      endsLocal: '19:00',
    })),
  )

  // Prices are integer minor units. Never a float, never a decimal column.
  const serviceRows = [
    { category: 'Hair', name: 'Cut and Blow Dry', durationMinutes: 75, priceMinor: 4500, sortOrder: 0, rebookIntervalDays: 42 },
    { category: 'Hair', name: 'Colour and Cut', durationMinutes: 150, priceMinor: 12000, sortOrder: 1, rebookIntervalDays: 42 },
    { category: 'Hair', name: 'Blow Dry', durationMinutes: 45, priceMinor: 3000, sortOrder: 2, rebookIntervalDays: 28 },
    { category: 'Nails', name: 'Gel Manicure', durationMinutes: 60, priceMinor: 3500, sortOrder: 3, rebookIntervalDays: 28 },
    { category: 'Nails', name: 'Gel Pedicure', durationMinutes: 60, priceMinor: 4000, sortOrder: 4, rebookIntervalDays: 42 },
  ]

  const services = await db
    .insert(schema.services)
    .values(
      serviceRows.map((s) => ({
        businessId: business.id,
        category: s.category,
        name: s.name,
        durationMinutes: s.durationMinutes,
        priceMinor: s.priceMinor,
        sortOrder: s.sortOrder,
        rebookIntervalDays: s.rebookIntervalDays,
        // Mobile work needs kit setup and pack-down, and it occupies the calendar.
        setupMinutes: 10,
        packdownMinutes: 10,
        bufferAfterMinutes: 0,
      })),
    )
    .returning({ id: schema.services.id })

  await db
    .insert(schema.serviceStaff)
    .values(services.map((s) => ({ serviceId: s.id, staffId: sam.id })))

  // Coverage: Lewisham, Blackheath and Greenwich — the areas named in the
  // out-of-area artboard. A 3.5km radius on each leaves SE22 outside, which is
  // what that screen demonstrates.
  await db.insert(schema.serviceAreas).values(
    (
      [
        ['Lewisham', PLACES.lewisham],
        ['Blackheath', PLACES.blackheath],
        ['Greenwich', PLACES.greenwich],
      ] as const
    ).map(([label, centre]) => ({
      businessId: business.id,
      staffId: null,
      kind: 'radius' as const,
      label,
      radiusMetres: 3500,
      centreGeog: sql`ST_SetSRID(ST_MakePoint(${centre.lng}, ${centre.lat}), 4326)::geography` as never,
    })),
  )

  await db.insert(schema.travelPolicies).values({
    businessId: business.id,
    staffId: null,
    maxLegMinutes: 45,
    maxDailyDriveMinutes: 180,
    // Every default biased conservative: a late arrival destroys the trust the
    // product runs on. Providers may tune down, never up after being burned.
    roadFactor: 1.3,
    defaultSpeedKmh: 25,
    fixedOverheadMinutes: 5,
  })

  const bookingCount = await seedDemoBookings({
    businessId: business.id,
    staffId: sam.id,
    serviceIds: services.map((s) => s.id),
    serviceRows,
    currency: 'GBP',
    cancellationWindowHours: 24,
  })

  console.log(`  business ${business.id}`)
  console.log(`  staff    Sam (${sam.id})`)
  console.log(`  services ${services.length}`)
  console.log(`  bookings ${bookingCount}`)
  console.log(`\nSeeded. Booking page: /${SLUG}   Dashboard: /api/dev/login`)
}

/**
 * A plausible week of bookings, so the dashboard is not empty.
 *
 * "An empty product demos badly" — planning/10-build-order.md. Customer names
 * and addresses come from the design canvas so the screens match the artboards.
 *
 * Times are business-local wall clock, converted through the business timezone,
 * and every appointment is spaced so the exclusion constraint is satisfied for
 * the single staff member.
 */
async function seedDemoBookings(input: {
  businessId: string
  staffId: string
  serviceIds: string[]
  serviceRows: { name: string; durationMinutes: number; priceMinor: number }[]
  currency: string
  cancellationWindowHours: number
}): Promise<number> {
  const { businessId, staffId, serviceIds, serviceRows, currency } = input

  const people = [
    { first: 'Priya', last: 'Sharma', phone: '+447700900123', line1: '22 Elm Road', postcode: 'SE13 7AA', lat: 51.4557, lng: -0.014 },
    { first: 'James', last: 'Okafor', phone: '+447700900456', line1: '14 Bridge Street', postcode: 'SE10 8JA', lat: 51.4812, lng: -0.0091 },
    { first: 'Amara', last: 'Nwosu', phone: '+447700900771', line1: '8 Vanbrugh Park', postcode: 'SE3 7AA', lat: 51.4762, lng: 0.0069 },
    { first: 'Chloe', last: 'Bennett', phone: '+447700900318', line1: '3 Ashby Mews', postcode: 'SE4 1TB', lat: 51.4661, lng: -0.0369 },
    { first: 'Rukhsana', last: 'Ali', phone: '+447700900902', line1: '61 Tressillian Road', postcode: 'SE4 1XY', lat: 51.4649, lng: -0.0301 },
    { first: 'Tom', last: 'Whitfield', phone: '+447700900544', line1: '9 Coleraine Road', postcode: 'SE3 7PQ', lat: 51.4789, lng: 0.0031 },
  ]

  // `customer` is global and is deliberately NOT cascaded by deleting the
  // business, so a re-run must reuse anyone already on file rather than
  // creating a duplicate. This is the same "match on exact normalised phone"
  // rung the real identity ladder uses.
  const customerIds: string[] = []
  for (const person of people) {
    const existing = await db.query.customers.findFirst({
      where: eq(schema.customers.phone, person.phone),
    })

    if (existing) {
      // These are Ofcom's reserved 07700 900xxx drama numbers, which exist only
      // for testing, so the seed owns them. Overwrite the name so a customer
      // left behind by an earlier manual test cannot show the wrong person
      // against these bookings. This is a seed-only liberty: the real identity
      // path never overwrites a customer's details from a guest booking.
      await db
        .update(schema.customers)
        .set({ firstName: person.first, lastName: person.last })
        .where(eq(schema.customers.id, existing.id))

      customerIds.push(existing.id)
      continue
    }

    const [row] = await db
      .insert(schema.customers)
      .values({
        firstName: person.first,
        lastName: person.last,
        phone: person.phone,
        firstSeenBusinessId: businessId,
      })
      .returning({ id: schema.customers.id })
    customerIds.push(row.id)

    await db
      .insert(schema.customerIdentities)
      .values({
        customerId: row.id,
        kind: 'phone',
        value: person.phone,
        confidence: 60,
      })
      .onConflictDoNothing()
  }

  // Day offsets are relative to today, so the dataset stays fresh whenever the
  // seed is re-run rather than decaying into the past before the demo.
  const plan: {
    dayOffset: number
    localTime: string
    serviceIndex: number
    personIndex: number
    source: 'gmb' | 'qr' | 'ig' | 'direct'
    status: 'confirmed' | 'completed' | 'pending_payment' | 'no_show'
    note?: string
  }[] = [
    { dayOffset: 0, localTime: '09:00', serviceIndex: 0, personIndex: 0, source: 'qr', status: 'completed', note: 'Buzzer is 22B, please ring rather than knock.' },
    { dayOffset: 0, localTime: '11:15', serviceIndex: 3, personIndex: 1, source: 'gmb', status: 'completed' },
    { dayOffset: 0, localTime: '14:00', serviceIndex: 1, personIndex: 2, source: 'gmb', status: 'confirmed', note: 'Going a shade lighter than last time.' },
    { dayOffset: 1, localTime: '09:30', serviceIndex: 2, personIndex: 3, source: 'ig', status: 'confirmed' },
    { dayOffset: 1, localTime: '13:15', serviceIndex: 1, personIndex: 5, source: 'direct', status: 'pending_payment', note: 'First-time customer.' },
    { dayOffset: 2, localTime: '10:00', serviceIndex: 0, personIndex: 0, source: 'qr', status: 'confirmed' },
    { dayOffset: 2, localTime: '14:15', serviceIndex: 3, personIndex: 1, source: 'gmb', status: 'confirmed' },
    { dayOffset: 3, localTime: '09:30', serviceIndex: 2, personIndex: 3, source: 'ig', status: 'confirmed' },
    { dayOffset: 3, localTime: '11:30', serviceIndex: 4, personIndex: 4, source: 'gmb', status: 'confirmed' },
    { dayOffset: 3, localTime: '15:00', serviceIndex: 0, personIndex: 5, source: 'direct', status: 'confirmed' },
    { dayOffset: 4, localTime: '10:00', serviceIndex: 0, personIndex: 2, source: 'gmb', status: 'confirmed' },
    { dayOffset: 4, localTime: '13:45', serviceIndex: 1, personIndex: 4, source: 'qr', status: 'confirmed' },
    { dayOffset: -3, localTime: '16:30', serviceIndex: 2, personIndex: 3, source: 'ig', status: 'no_show' },
    { dayOffset: -6, localTime: '10:00', serviceIndex: 3, personIndex: 0, source: 'qr', status: 'completed' },
  ]

  const today = new Date()
  const todayLocal = formatInTimeZone(today, TIMEZONE, 'yyyy-MM-dd')
  let created = 0

  for (const entry of plan) {
    const service = serviceRows[entry.serviceIndex]
    const person = people[entry.personIndex]

    const date = addDaysIso(todayLocal, entry.dayOffset)
    // Closed Sunday and Monday, so skip rather than create an impossible booking.
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    if (weekday === 0 || weekday === 1) continue

    const startsAt = fromZonedTime(`${date}T${entry.localTime}:00`, TIMEZONE)
    // setup + duration + packdown all occupy the calendar.
    const occupiedMinutes = service.durationMinutes + 20
    const endsAt = new Date(startsAt.getTime() + occupiedMinutes * 60_000)

    const [loc] = await db
      .insert(schema.locations)
      .values({
        line1: person.line1,
        city: 'London',
        postcode: person.postcode,
        country: 'GB',
        lat: person.lat,
        lng: person.lng,
        geog: sql`ST_SetSRID(ST_MakePoint(${person.lng}, ${person.lat}), 4326)::geography` as never,
      })
      .returning({ id: schema.locations.id })

    const [booking] = await db
      .insert(schema.bookings)
      .values({
        businessId,
        staffId,
        serviceId: serviceIds[entry.serviceIndex],
        customerId: customerIds[entry.personIndex],
        startsAt,
        endsAt,
        serviceLocationId: loc.id,
        travelInMinutes: 18,
        travelOutMinutes: 14,
        status: entry.status,
        priceMinor: service.priceMinor,
        currency,
        source: entry.source,
        customerNote: entry.note ?? null,
        policySnapshot: {
          cancellationWindowHours: input.cancellationWindowHours,
          depositPercent: 0,
          noShowFeeMinor: 0,
          text: null,
        },
        accessTokenHash: createHash('sha256')
          .update(`seed-${entry.dayOffset}-${entry.localTime}-${entry.personIndex}`)
          .digest('hex'),
      })
      .returning({ id: schema.bookings.id })

    // No status change without a booking_event, seeds included.
    await db.insert(schema.bookingEvents).values({
      bookingId: booking.id,
      fromStatus: null,
      toStatus: entry.status,
      actorType: 'system',
      payload: { seeded: true },
    })

    created += 1
  }

  // The business's own view of each customer.
  for (let i = 0; i < people.length; i++) {
    const theirs = plan.filter((p) => p.personIndex === i)
    if (theirs.length === 0) continue
    const spend = theirs.reduce((sum, p) => sum + serviceRows[p.serviceIndex].priceMinor, 0)
    const lastOffset = Math.max(...theirs.map((p) => p.dayOffset))

    await db
      .insert(schema.businessCustomers)
      .values({
        businessId,
        customerId: customerIds[i],
        displayName: `${people[i].first} ${people[i].last}`,
        totalBookings: theirs.length,
        totalSpendMinor: spend,
        firstBookedAt: new Date(Date.now() - 40 * 86_400_000),
        lastBookedAt: new Date(Date.now() + lastOffset * 86_400_000),
        marketingConsent: false,
      })
      .onConflictDoNothing()
  }

  return created
}

function addDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await client.end({ timeout: 5 })
  })
