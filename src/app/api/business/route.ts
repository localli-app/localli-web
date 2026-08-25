import type { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { getStaffSession } from '@/lib/auth/staff-session'
import { uniqueSlug } from '@/lib/auth/signup'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { AppError } from '@/lib/errors'
import { businessProfileSchema } from '@/lib/validation/business'

export async function GET() {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    const business = await db.query.businesses.findFirst({
      where: eq(s.businesses.id, session.businessId),
    })
    if (!business) return failure(new AppError('NOT_FOUND', 'Business not found.'))

    return ok({
      id: business.id,
      slug: business.slug,
      name: business.name,
      description: business.description,
      phone: business.phone,
      timezone: business.timezone,
      currency: business.currency,
      isMobileEnabled: business.isMobileEnabled,
      onboardingCompletedAt: business.onboardingCompletedAt?.toISOString() ?? null,
    })
  })
}

/**
 * Profile and settings. Used by the wizard and by Settings.
 *
 * Anything that can change which slots are bookable bumps `availabilityVersion`,
 * which is part of the availability cache key. Forgetting this produces a
 * confusing class of bug where the booking page keeps showing stale times.
 */
export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    const body = businessProfileSchema.parse(await request.json())

    const business = await db.query.businesses.findFirst({
      where: eq(s.businesses.id, session.businessId),
    })
    if (!business) return failure(new AppError('NOT_FOUND', 'Business not found.'))

    // A slug collision is a message to fix, not a silent rename — the owner is
    // watching their booking link as they type it.
    if (body.slug && body.slug !== business.slug) {
      const taken = await db.query.businesses.findFirst({ where: eq(s.businesses.slug, body.slug) })
      if (taken && taken.id !== business.id) {
        throw new AppError('VALIDATION_FAILED', 'That link is already taken. Try another.', {
          field: 'slug',
          suggestion: await uniqueSlug(body.slug),
        })
      }
    }

    const affectsAvailability =
      body.timezone !== undefined || body.isMobileEnabled !== undefined

    await db.transaction(async (tx) => {
      let addressLocationId = business.addressLocationId

      if (body.address) {
        const values = {
          line1: body.address.line1,
          city: body.address.city ?? null,
          postcode: body.address.postcode ?? null,
          country: 'GB',
          lat: body.address.lat ?? null,
          lng: body.address.lng ?? null,
          // Only build a point when we actually geocoded; a null geography is
          // better than a (0,0) one, which would sit in the Gulf of Guinea.
          geog:
            body.address.lat != null && body.address.lng != null
              ? (sql`ST_SetSRID(ST_MakePoint(${body.address.lng}, ${body.address.lat}), 4326)::geography` as never)
              : null,
        }

        if (addressLocationId) {
          await tx.update(s.locations).set(values).where(eq(s.locations.id, addressLocationId))
        } else {
          const [created] = await tx
            .insert(s.locations)
            .values(values)
            .returning({ id: s.locations.id })
          addressLocationId = created.id
        }
      }

      await tx
        .update(s.businesses)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.slug !== undefined ? { slug: body.slug } : {}),
          ...(body.description !== undefined ? { description: body.description ?? null } : {}),
          ...(body.phone !== undefined ? { phone: body.phone ?? null } : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.isMobileEnabled !== undefined
            ? { isMobileEnabled: body.isMobileEnabled }
            : {}),
          ...(addressLocationId !== business.addressLocationId ? { addressLocationId } : {}),
          updatedAt: new Date(),
          ...(affectsAvailability
            ? { availabilityVersion: sql`${s.businesses.availabilityVersion} + 1` }
            : {}),
        })
        .where(eq(s.businesses.id, business.id))

      // A mobile business needs somewhere to travel from and a radius, or the
      // booking page has nothing to check an address against.
      if (body.serviceRadiusMetres && body.address?.lat != null && body.address?.lng != null) {
        await tx.delete(s.serviceAreas).where(eq(s.serviceAreas.businessId, business.id))
        await tx.insert(s.serviceAreas).values({
          businessId: business.id,
          staffId: null,
          kind: 'radius',
          label: body.address.city ?? body.address.postcode ?? 'Your area',
          radiusMetres: body.serviceRadiusMetres,
          centreGeog:
            sql`ST_SetSRID(ST_MakePoint(${body.address.lng}, ${body.address.lat}), 4326)::geography` as never,
        })

        const policy = await tx.query.travelPolicies.findFirst({
          where: eq(s.travelPolicies.businessId, business.id),
        })
        if (!policy) {
          // Conservative defaults: a late arrival destroys the trust the
          // product runs on. Providers tune down, never up after being burned.
          await tx.insert(s.travelPolicies).values({ businessId: business.id, staffId: null })
        }
      }
    })

    const updated = await db.query.businesses.findFirst({
      where: eq(s.businesses.id, business.id),
    })

    return ok({ slug: updated?.slug, name: updated?.name })
  })
}
