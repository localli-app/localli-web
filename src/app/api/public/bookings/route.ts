import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { handleRoute } from '@/lib/api/respond'
import { createBooking } from '@/lib/booking/create'
import { createBookingSchema } from '@/lib/validation/booking'

/** One year. The device cookie is recognition only and never authority. */
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * The most important endpoint in the product.
 *
 * NOT YET WIRED (deliberately, per planning/10-build-order.md):
 * Turnstile, rate limiting, reminder/auto-complete jobs, and the confirmation
 * email. Rate limiting and Turnstile must land before this URL is public.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = createBookingSchema.parse(await request.json())

    // Customers double-tap on slow connections. A client-supplied key is
    // preferred; a generated one at least keeps the insert well-formed.
    const idempotencyKey = request.headers.get('Idempotency-Key') ?? randomUUID()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin

    const { booking, reused, deviceToken } = await createBooking(body, {
      idempotencyKey,
      appUrl,
    })

    const response = Response.json({ data: booking }, { status: reused ? 200 : 201 })

    // Step 11: recognition on the next visit, scoped to the Localli domain so
    // it works across every business on the platform.
    if (deviceToken) {
      response.headers.append(
        'Set-Cookie',
        `ll_device=${deviceToken}; Path=/; Max-Age=${DEVICE_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly${
          process.env.NODE_ENV === 'production' ? '; Secure' : ''
        }`,
      )
    }

    return response
  })
}
