/**
 * Localli database schema (Drizzle, Postgres + PostGIS).
 *
 * This is the starting point. Copy to src/lib/db/schema.ts and evolve it there.
 *
 * Two things Drizzle cannot express that MUST be added by hand in a migration:
 *   1. The booking overlap EXCLUDE constraint. See the SQL block at the bottom.
 *   2. PostGIS geography columns. Declared here as customType, created in SQL.
 *
 * Read planning/05-domain-model.md before changing anything structural.
 */

import { sql } from 'drizzle-orm'
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  time,
  date,
  uuid,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  customType,
  doublePrecision,
} from 'drizzle-orm/pg-core'

/* ────────────────────────────────────────────────────────────────
   Custom types
   ──────────────────────────────────────────────────────────────── */

/** PostGIS geography(POINT, 4326). Stored as WKT on write, hex EWKB on read. */
export const geography = customType<{ data: string; driverData: string }>({
  dataType: () => 'geography(Point, 4326)',
})

/* ────────────────────────────────────────────────────────────────
   Enums
   ──────────────────────────────────────────────────────────────── */

export const planEnum = pgEnum('plan', ['free', 'paid'])

export const staffRoleEnum = pgEnum('staff_role', ['owner', 'manager', 'staff'])

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending_payment',
  'confirmed',
  'in_progress',
  'completed',
  'no_show',
  'cancelled_by_customer',
  'cancelled_by_business',
])

/** Statuses that occupy the calendar. Mirrored in the EXCLUDE constraint below. */
export const OCCUPYING_STATUSES = ['confirmed', 'in_progress'] as const

export const bookingSourceEnum = pgEnum('booking_source', [
  'gmb', // Google Business Profile book button
  'qr',
  'ig',
  'sms',
  'web', // embedded on the business's own site
  'direct',
  'manual', // entered by the business
  'marketplace', // phase 5, unused for now
])

export const identityKindEnum = pgEnum('identity_kind', [
  'email',
  'phone',
  'device_token',
])

export const actorTypeEnum = pgEnum('actor_type', [
  'customer',
  'staff',
  'system',
])

export const serviceAreaKindEnum = pgEnum('service_area_kind', [
  'radius',
  'polygon',
  'postcodes',
])

export const paymentKindEnum = pgEnum('payment_kind', [
  'deposit',
  'balance',
  'full',
  'no_show_fee',
  'refund',
])

/* ────────────────────────────────────────────────────────────────
   Locations
   ──────────────────────────────────────────────────────────────── */

export const locations = pgTable(
  'location',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city'),
    region: text('region'),
    postcode: text('postcode'),
    country: text('country').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    geog: geography('geog'),
    accessNotes: text('access_notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // GIST index created in SQL migration: CREATE INDEX ... USING gist (geog);
    postcodeIdx: index('location_postcode_idx').on(t.postcode),
  }),
)

/* ────────────────────────────────────────────────────────────────
   Business
   ──────────────────────────────────────────────────────────────── */

export const businesses = pgTable(
  'business',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),

    /** IANA zone, e.g. "Europe/London". NEVER a fixed offset. */
    timezone: text('timezone').notNull(),
    /** ISO 4217, e.g. "GBP". All amounts on this business are in this currency. */
    currency: text('currency').notNull(),

    addressLocationId: uuid('address_location_id').references(
      () => locations.id,
      { onDelete: 'set null' },
    ),
    phone: text('phone'),
    email: text('email').notNull(),
    logoUrl: text('logo_url'),
    photos: jsonb('photos').$type<string[]>().default([]),

    plan: planEnum('plan').notNull().default('free'),
    stripeAccountId: text('stripe_account_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),

    /** Gates the entire travel module. Fixed-premises businesses never see it. */
    isMobileEnabled: boolean('is_mobile_enabled').notNull().default(false),

    bookingSettings: jsonb('booking_settings')
      .$type<BookingSettings>()
      .notNull()
      .default(defaultBookingSettings()),

    /** Bumped on any change affecting availability. Part of the cache key. */
    availabilityVersion: integer('availability_version').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('business_slug_idx').on(t.slug),
  }),
)

export type BookingSettings = {
  slotGranularityMinutes: number // default 15
  minNoticeMinutes: number // default 120
  maxAdvanceDays: number // default 60
  cancellationWindowHours: number // default 24
  requireLastName: boolean // default false
  contactField: 'phone' | 'email' // which one is required. default 'phone'
  autoCompleteAfterMinutes: number // default 60. See R3 in the risks doc.
  assignmentRule: 'least_utilised' | 'round_robin' | 'first_available'
}

export function defaultBookingSettings(): BookingSettings {
  return {
    slotGranularityMinutes: 15,
    minNoticeMinutes: 120,
    maxAdvanceDays: 60,
    cancellationWindowHours: 24,
    requireLastName: false,
    contactField: 'phone',
    autoCompleteAfterMinutes: 60,
    assignmentRule: 'least_utilised',
  }
}

/* ────────────────────────────────────────────────────────────────
   Staff
   ──────────────────────────────────────────────────────────────── */

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    role: staffRoleEnum('role').notNull().default('staff'),
    /** Set when this staff member can log in to the dashboard. */
    email: text('email'),
    isBookable: boolean('is_bookable').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    businessIdx: index('staff_business_idx').on(t.businessId),
  }),
)

/* ────────────────────────────────────────────────────────────────
   Services
   ──────────────────────────────────────────────────────────────── */

export const services = pgTable(
  'service',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    category: text('category'), // "Hair", "Nails", "Lashes", ...
    name: text('name').notNull(),
    description: text('description'),

    /** Hands-on time. */
    durationMinutes: integer('duration_minutes').notNull(),
    /** Cleanup / turnaround after. Occupies the calendar. */
    bufferAfterMinutes: integer('buffer_after_minutes').notNull().default(0),
    /** Mobile only: kit setup before, pack-down after. Occupies the calendar. */
    setupMinutes: integer('setup_minutes').notNull().default(0),
    packdownMinutes: integer('packdown_minutes').notNull().default(0),

    priceMinor: integer('price_minor').notNull(),
    depositPercent: integer('deposit_percent').notNull().default(0),

    /** Drives the timed rebook nudge. e.g. 42 for a 6-week colour cycle. */
    rebookIntervalDays: integer('rebook_interval_days'),

    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    businessIdx: index('service_business_idx').on(t.businessId),
  }),
)

/** Which staff can perform which service. */
export const serviceStaff = pgTable(
  'service_staff',
  {
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.serviceId, t.staffId] }),
    staffIdx: index('service_staff_staff_idx').on(t.staffId),
  }),
)

/* ────────────────────────────────────────────────────────────────
   Hours and blackouts
   ──────────────────────────────────────────────────────────────── */

export const businessHours = pgTable(
  'business_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** 0 = Sunday .. 6 = Saturday */
    weekday: integer('weekday').notNull(),
    /** Local wall-clock in the business timezone. Materialised per date. */
    opensLocal: time('opens_local').notNull(),
    closesLocal: time('closes_local').notNull(),
  },
  (t) => ({
    businessIdx: index('business_hours_business_idx').on(t.businessId),
  }),
)

export const staffHours = pgTable(
  'staff_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    startsLocal: time('starts_local').notNull(),
    endsLocal: time('ends_local').notNull(),
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),
  },
  (t) => ({
    staffIdx: index('staff_hours_staff_idx').on(t.staffId),
  }),
)

export const blackouts = pgTable(
  'blackout',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** null = whole business is closed for this period */
    staffId: uuid('staff_id').references(() => staff.id, {
      onDelete: 'cascade',
    }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    businessRangeIdx: index('blackout_business_range_idx').on(
      t.businessId,
      t.startsAt,
    ),
  }),
)

/* ────────────────────────────────────────────────────────────────
   THE CUSTOMER GRAPH
   customer is GLOBAL. Not a child of business. This is the single most
   important schema decision in the product. See planning/05-domain-model.md.
   ──────────────────────────────────────────────────────────────── */

export const customers = pgTable(
  'customer',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email'),
    phone: text('phone'), // E.164, normalised at write time
    firstName: text('first_name'),
    lastName: text('last_name'),
    /** Set when they opened a magic link. Booking NEVER requires verification. */
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    defaultLocale: text('default_locale'),
    firstSeenBusinessId: uuid('first_seen_business_id').references(
      () => businesses.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: index('customer_email_idx').on(t.email),
    phoneIdx: index('customer_phone_idx').on(t.phone),
  }),
)

/** How we recognise a customer. Multiple rows per customer. */
export const customerIdentities = pgTable(
  'customer_identity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    kind: identityKindEnum('kind').notNull(),
    value: text('value').notNull(),
    /** 0..100. Device tokens are lower confidence than a verified email. */
    confidence: integer('confidence').notNull().default(50),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    lookupIdx: uniqueIndex('customer_identity_lookup_idx').on(t.kind, t.value),
    customerIdx: index('customer_identity_customer_idx').on(t.customerId),
  }),
)

/**
 * The business's own view of a customer. Everything here is exportable by the
 * business. What is NOT here (that the same person books elsewhere) is not
 * theirs and must never be exposed to them. See R6 in the risks doc.
 */
export const businessCustomers = pgTable(
  'business_customer',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    notes: text('notes'),
    tags: text('tags').array(),
    firstBookedAt: timestamp('first_booked_at', { withTimezone: true }),
    lastBookedAt: timestamp('last_booked_at', { withTimezone: true }),
    totalBookings: integer('total_bookings').notNull().default(0),
    totalSpendMinor: integer('total_spend_minor').notNull().default(0),
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    isBlocked: boolean('is_blocked').notNull().default(false),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.businessId, t.customerId] }),
    customerIdx: index('business_customer_customer_idx').on(t.customerId),
  }),
)

/** Magic-link sessions. The only auth mechanism in the product. */
export const customerSessions = pgTable(
  'customer_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => ({
    tokenIdx: uniqueIndex('customer_session_token_idx').on(t.tokenHash),
  }),
)

/** Same mechanism for business dashboard logins. */
export const staffSessions = pgTable(
  'staff_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: uniqueIndex('staff_session_token_idx').on(t.tokenHash),
  }),
)

/* ────────────────────────────────────────────────────────────────
   Bookings
   ──────────────────────────────────────────────────────────────── */

export const bookings = pgTable(
  'booking',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),

    /**
     * Bounds the calendar-occupying block: setup + duration + packdown/buffer.
     * Travel is NOT included here, it is stored separately so it can be
     * recomputed without moving the appointment.
     */
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),

    /** Mobile only: where the service happens. Null for fixed premises. */
    serviceLocationId: uuid('service_location_id').references(
      () => locations.id,
      { onDelete: 'set null' },
    ),
    travelInMinutes: integer('travel_in_minutes'),
    travelOutMinutes: integer('travel_out_minutes'),

    status: bookingStatusEnum('status').notNull().default('confirmed'),
    priceMinor: integer('price_minor').notNull(),
    depositMinor: integer('deposit_minor').notNull().default(0),
    currency: text('currency').notNull(),

    source: bookingSourceEnum('source').notNull().default('direct'),
    /** Free-form extra attribution, e.g. which QR code. */
    sourceDetail: text('source_detail'),

    customerNote: text('customer_note'),
    staffNote: text('staff_note'),

    /** Cancellation terms frozen at booking time. Applied on cancel, not the current policy. */
    policySnapshot: jsonb('policy_snapshot').$type<PolicySnapshot>().notNull(),

    /** Public token for cancel/reschedule links. No login required. */
    accessTokenHash: text('access_token_hash').notNull(),

    /** Dedupe key for double-tapped submits. */
    idempotencyKey: text('idempotency_key'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    businessRangeIdx: index('booking_business_range_idx').on(
      t.businessId,
      t.startsAt,
    ),
    staffRangeIdx: index('booking_staff_range_idx').on(t.staffId, t.startsAt),
    customerIdx: index('booking_customer_idx').on(t.customerId),
    tokenIdx: uniqueIndex('booking_token_idx').on(t.accessTokenHash),
    idempotencyIdx: uniqueIndex('booking_idempotency_idx').on(
      t.businessId,
      t.idempotencyKey,
    ),
  }),
)

export type PolicySnapshot = {
  cancellationWindowHours: number
  depositPercent: number
  noShowFeeMinor: number
  text: string | null
}

/** Append-only audit log. No status change without a row here. */
export const bookingEvents = pgTable(
  'booking_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    fromStatus: bookingStatusEnum('from_status'),
    toStatus: bookingStatusEnum('to_status'),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bookingIdx: index('booking_event_booking_idx').on(t.bookingId),
  }),
)

/* ────────────────────────────────────────────────────────────────
   Receipts
   The mechanism that turns a guest booking into a customer identity.
   opened_at and portal_visited_at are the funnel metrics for the entire
   strategy. Instrument them from day one.
   ──────────────────────────────────────────────────────────────── */

export const receipts = pgTable(
  'receipt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** Long-lived (90d) magic token. Scoped: opens this receipt + own history only. */
    tokenHash: text('token_hash').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    portalVisitedAt: timestamp('portal_visited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('receipt_token_idx').on(t.tokenHash),
    bookingIdx: uniqueIndex('receipt_booking_idx').on(t.bookingId),
  }),
)

/* ────────────────────────────────────────────────────────────────
   Payments (schema now, wiring later. Not in the demo build.)
   ──────────────────────────────────────────────────────────────── */

export const payments = pgTable(
  'payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    kind: paymentKindEnum('kind').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bookingIdx: index('payment_booking_idx').on(t.bookingId),
  }),
)

/* ────────────────────────────────────────────────────────────────
   Mobile module. Only relevant when business.isMobileEnabled.
   ──────────────────────────────────────────────────────────────── */

export const serviceAreas = pgTable(
  'service_area',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** null = applies to the whole business */
    staffId: uuid('staff_id').references(() => staff.id, {
      onDelete: 'cascade',
    }),
    kind: serviceAreaKindEnum('kind').notNull(),
    label: text('label'),
    centreGeog: geography('centre_geog'),
    radiusMetres: integer('radius_metres'),
    /** geography(Polygon, 4326), added in SQL migration for kind='polygon'. */
    postcodes: text('postcodes').array(),
    travelSurchargeMinor: integer('travel_surcharge_minor')
      .notNull()
      .default(0),
  },
  (t) => ({
    businessIdx: index('service_area_business_idx').on(t.businessId),
  }),
)

export const travelPolicies = pgTable(
  'travel_policy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').references(() => staff.id, {
      onDelete: 'cascade',
    }),
    maxLegMinutes: integer('max_leg_minutes').notNull().default(45),
    maxDailyDriveMinutes: integer('max_daily_drive_minutes')
      .notNull()
      .default(180),
    /** Straight-line distance multiplier. Bias HIGH: a late arrival kills trust. */
    roadFactor: doublePrecision('road_factor').notNull().default(1.3),
    defaultSpeedKmh: doublePrecision('default_speed_kmh').notNull().default(25),
    /** Parking, door-to-door, finding the flat. Bias generous. */
    fixedOverheadMinutes: integer('fixed_overhead_minutes').notNull().default(5),
  },
  (t) => ({
    businessIdx: index('travel_policy_business_idx').on(t.businessId),
  }),
)

export const travelEstimateCache = pgTable(
  'travel_estimate_cache',
  {
    /** geohash precision 6, roughly 1.2km x 0.6km. */
    originCell: text('origin_cell').notNull(),
    destCell: text('dest_cell').notNull(),
    /** Hour of day 0..23, or a coarser bucket. */
    timeBucket: integer('time_bucket').notNull(),
    minutes: integer('minutes').notNull(),
    distanceMetres: integer('distance_metres'),
    source: text('source').notNull(), // 'haversine' | 'matrix_api'
    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.originCell, t.destCell, t.timeBucket],
    }),
  }),
)

/**
 * Requests for addresses outside every service area. Unmet demand is data:
 * it tells the business where to expand. Logged, never surfaced as an error.
 */
export const outOfAreaRequests = pgTable(
  'out_of_area_request',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    postcode: text('postcode'),
    serviceId: uuid('service_id').references(() => services.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    businessIdx: index('out_of_area_business_idx').on(t.businessId),
  }),
)

/* ────────────────────────────────────────────────────────────────
   RAW SQL that MUST go in a migration.
   Drizzle cannot express these. Do not skip them.
   ──────────────────────────────────────────────────────────────── */

export const requiredRawSql = sql`
  -- Extensions
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS btree_gist;

  -- Geospatial indexes
  CREATE INDEX IF NOT EXISTS location_geog_idx
    ON location USING gist (geog);
  CREATE INDEX IF NOT EXISTS service_area_centre_idx
    ON service_area USING gist (centre_geog);

  -- THE constraint that makes double booking structurally impossible.
  -- No application logic, no distributed lock, no race window between
  -- checking availability and writing the row.
  ALTER TABLE booking ADD CONSTRAINT booking_no_overlap
    EXCLUDE USING gist (
      staff_id WITH =,
      tstzrange(starts_at, ends_at) WITH &&
    )
    WHERE (status IN ('confirmed', 'in_progress'));

  -- Sanity: a booking cannot end before it starts.
  ALTER TABLE booking ADD CONSTRAINT booking_valid_range
    CHECK (ends_at > starts_at);

  -- Bump availability_version on anything that invalidates cached slots.
  CREATE OR REPLACE FUNCTION bump_availability_version()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE business
      SET availability_version = availability_version + 1
      WHERE id = COALESCE(NEW.business_id, OLD.business_id);
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER booking_bump_version
    AFTER INSERT OR UPDATE OR DELETE ON booking
    FOR EACH ROW EXECUTE FUNCTION bump_availability_version();

  CREATE TRIGGER blackout_bump_version
    AFTER INSERT OR UPDATE OR DELETE ON blackout
    FOR EACH ROW EXECUTE FUNCTION bump_availability_version();
`

/*
 * NOTE on the exclusion constraint and the application:
 *
 * The constraint throws SQLSTATE 23P01 (exclusion_violation) on conflict.
 * Catch it in the booking creation path and return HTTP 409 with
 * code SLOT_TAKEN. Do NOT pre-check for a conflict and then insert:
 * that reintroduces the race the constraint exists to remove.
 *
 * Travel feasibility (mobile module) CANNOT be expressed as a constraint
 * and stays an application check inside the same transaction. That is
 * acceptable: the failure mode of a travel-check race is a tight day,
 * not a physically impossible double booking.
 */
