import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { clearStaffSession, getStaffSession } from '@/lib/auth/staff-session'
import { recordAuthEvent } from '@/lib/auth/audit'

/**
 * Signs out the current device.
 *
 * POST only: a GET would let any page log someone out with an <img> tag, and
 * would be prefetched by browsers and link scanners.
 */
export async function POST(request: NextRequest) {
  const session = await getStaffSession()

  if (session) {
    await recordAuthEvent({
      kind: 'signed_out',
      email: session.staffEmail,
      staffId: session.staffId,
      businessId: session.businessId,
      headers: request.headers,
    })
  }

  await clearStaffSession()

  const wantsHtml = request.headers.get('accept')?.includes('text/html')
  if (wantsHtml) redirect('/app/signin')

  return new Response(null, { status: 204 })
}
