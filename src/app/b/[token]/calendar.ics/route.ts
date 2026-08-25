import type { NextRequest } from 'next/server'
import { buildIcs, getBookingByAccessToken } from '@/lib/booking/manage'

/**
 * The "Add to calendar" action on the confirmation screen.
 * Served under /b/<token>/ so the link works straight from an email or SMS.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/b/[token]/calendar.ics'>,
) {
  const { token } = await ctx.params
  const booking = await getBookingByAccessToken(token)
  if (!booking) return new Response('Not found', { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const ics = buildIcs(booking, `${appUrl}/b/${token}`)

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${booking.businessSlug || 'appointment'}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
