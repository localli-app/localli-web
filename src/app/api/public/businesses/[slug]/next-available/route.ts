import type { NextRequest } from 'next/server'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { nextAvailable } from '@/lib/booking/slots'
import { getPublicBusinessBySlug } from '@/lib/db/queries'
import { AppError } from '@/lib/errors'
import { localDateOf } from '@/lib/format'
import { nextAvailableQuerySchema } from '@/lib/validation/booking'

/**
 * The three big buttons that appear before any calendar.
 * Most bookings should come from here, so keep it cheap.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/public/businesses/[slug]/next-available'>,
) {
  return handleRoute(async () => {
    const { slug } = await ctx.params
    const query = nextAvailableQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    )

    const business = await getPublicBusinessBySlug(slug)
    if (!business) {
      return failure(new AppError('BUSINESS_INACTIVE', 'That business is not taking bookings.'))
    }

    const now = new Date()
    const result = await nextAvailable({
      businessId: business.id,
      serviceId: query.serviceId,
      staffId: query.staffId,
      fromDate: query.from ?? localDateOf(now, business.timezone),
      destination:
        query.lat !== undefined && query.lng !== undefined
          ? { lat: query.lat, lng: query.lng }
          : null,
      now,
    })

    if (result.outOfArea) {
      return failure(
        new AppError('OUT_OF_AREA', `${business.name} doesn't travel to that area yet.`),
      )
    }

    return ok({ timezone: result.timezone, slots: result.slots })
  })
}
