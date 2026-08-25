import 'dotenv/config'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
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
      timezone: 'Europe/London',
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

  console.log(`  business ${business.id}`)
  console.log(`  staff    Sam (${sam.id})`)
  console.log(`  services ${services.length}`)
  console.log(`\nSeeded. Booking page: /${SLUG}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await client.end({ timeout: 5 })
  })
