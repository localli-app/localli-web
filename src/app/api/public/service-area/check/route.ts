import type { NextRequest } from 'next/server'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { isInServiceArea } from '@/lib/availability'
import { db } from '@/lib/db/client'
import { getPublicBusinessBySlug } from '@/lib/db/queries'
import * as s from '@/lib/db/schema'
import { AppError } from '@/lib/errors'
import { serviceAreaCheckSchema } from '@/lib/validation/booking'
import { and, eq, sql } from 'drizzle-orm'

/**
 * Called on address entry, so a customer learns they are out of area BEFORE
 * they pick a time rather than after. Out of area is information, not an error
 * state — the client renders it as a normal screen.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = serviceAreaCheckSchema.parse(await request.json())

    const business = await getPublicBusinessBySlug(body.businessSlug)
    if (!business) {
      return failure(new AppError('BUSINESS_INACTIVE', 'That business is not taking bookings.'))
    }
    if (!business.isMobile) {
      return ok({ inArea: true, surchargeMinor: 0, areaLabels: [] })
    }

    const areas = await db
      .select({
        staffId: s.serviceAreas.staffId,
        label: s.serviceAreas.label,
        radiusMetres: s.serviceAreas.radiusMetres,
        surcharge: s.serviceAreas.travelSurchargeMinor,
        lat: sql<number>`ST_Y(${s.serviceAreas.centreGeog}::geometry)`,
        lng: sql<number>`ST_X(${s.serviceAreas.centreGeog}::geometry)`,
      })
      .from(s.serviceAreas)
      .where(and(eq(s.serviceAreas.businessId, business.id), eq(s.serviceAreas.kind, 'radius')))

    const staffIds = business.staff.map((st) => st.id)
    const inArea = isInServiceArea(
      { lat: body.lat, lng: body.lng },
      areas
        .filter((a) => a.radiusMetres != null)
        .map((a) => ({
          staffId: a.staffId,
          centre: { lat: Number(a.lat), lng: Number(a.lng) },
          radiusMetres: a.radiusMetres!,
        })),
      staffIds,
    )

    if (!inArea) {
      // Unmet demand is data: it tells the business where to expand.
      await db.insert(s.outOfAreaRequests).values({
        businessId: business.id,
        lat: body.lat,
        lng: body.lng,
      })
    }

    return ok({
      inArea,
      surchargeMinor: 0,
      // Named coverage areas, so the out-of-area screen can say what they DO cover.
      areaLabels: areas.map((a) => a.label).filter((l): l is string => Boolean(l)),
    })
  })
}
