import type { NextRequest } from 'next/server'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { computeSlots } from '@/lib/booking/slots'
import { getPublicBusinessBySlug } from '@/lib/db/queries'
import { AppError } from '@/lib/errors'
import { availabilityQuerySchema } from '@/lib/validation/booking'

/**
 * The calendar. This is the hot path — p95 must stay under 200ms.
 * See planning/09-api-spec.md.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/public/businesses/[slug]/availability'>) {
  return handleRoute(async () => {
    const { slug } = await ctx.params
    const query = availabilityQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    )

    const business = await getPublicBusinessBySlug(slug)
    if (!business) {
      return failure(new AppError('BUSINESS_INACTIVE', 'That business is not taking bookings.'))
    }

    const result = await computeSlots({
      businessId: business.id,
      serviceId: query.serviceId,
      staffId: query.staffId,
      from: query.from,
      to: query.to,
      destination: query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng }
        : null,
    })

    if (result.outOfArea) {
      return failure(
        new AppError('OUT_OF_AREA', `${business.name} doesn't travel to that area yet.`, {
          canJoinWaitlist: false,
        }),
      )
    }

    return ok({ timezone: result.timezone, days: result.days })
  })
}
