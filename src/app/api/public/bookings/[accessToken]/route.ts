import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { cancelBooking, getBookingByAccessToken } from '@/lib/booking/manage'
import { AppError } from '@/lib/errors'
import { formatMoney } from '@/lib/format'

const cancelSchema = z.object({ reason: z.string().trim().max(500).nullish() }).default({})

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/public/bookings/[accessToken]'>,
) {
  return handleRoute(async () => {
    const { accessToken } = await ctx.params
    const booking = await getBookingByAccessToken(accessToken)
    // 404, never 403: a 403 confirms the token format was right.
    if (!booking) return failure(new AppError('INVALID_TOKEN', 'Booking not found.'))

    return ok({
      id: booking.id,
      status: booking.status,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      timezone: booking.timezone,
      service: { name: booking.serviceName },
      staff: { name: booking.staffName },
      business: {
        name: booking.businessName,
        slug: booking.businessSlug,
        phone: booking.businessPhone,
      },
      price: { amountMinor: booking.priceMinor, currency: booking.currency },
      serviceAddress: booking.serviceAddress,
      canCancel: booking.canCancel,
      canReschedule: booking.canReschedule,
      lateCancellationFee: {
        amountMinor: booking.lateCancellationFeeMinor,
        currency: booking.currency,
        label: formatMoney(booking.lateCancellationFeeMinor, booking.currency),
      },
    })
  })
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/public/bookings/[accessToken]'>,
) {
  return handleRoute(async () => {
    const { accessToken } = await ctx.params
    const body = cancelSchema.parse(await request.json().catch(() => ({})))
    const result = await cancelBooking(accessToken, body.reason ?? null)
    return ok(result)
  })
}
