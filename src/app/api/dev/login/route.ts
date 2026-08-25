import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { createStaffSession, STAFF_COOKIE, staffCookieOptions } from '@/lib/auth/staff-session'

/**
 * DEV ONLY. Signs in as a business's owner without a magic link, so the
 * dashboard is demoable before magic-link issuance is built
 * (planning/10-build-order.md: "No auth on the dashboard for the demo").
 *
 * Refuses to run in production. Replace with
 * POST /api/auth/business/request-link + GET /api/auth/business/verify.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'Not found.' } },
      { status: 404 },
    )
  }

  const slug = request.nextUrl.searchParams.get('slug') ?? 'glow-studio'

  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.slug, slug) })
  if (!business) {
    return Response.json(
      { error: { code: 'NOT_FOUND', message: `No business with slug "${slug}". Run npm run db:seed.` } },
      { status: 404 },
    )
  }

  // Prefer the owner, fall back to whoever sorts first.
  const owner =
    (await db.query.staff.findFirst({
      where: and(eq(s.staff.businessId, business.id), eq(s.staff.role, 'owner')),
    })) ??
    (await db.query.staff.findFirst({
      where: eq(s.staff.businessId, business.id),
      orderBy: asc(s.staff.sortOrder),
    }))

  if (!owner) {
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'That business has no staff to sign in as.' } },
      { status: 404 },
    )
  }

  const token = await createStaffSession(owner.id, { headers: request.headers })
  const store = await cookies()
  store.set(STAFF_COOKIE, token, staffCookieOptions())

  redirect('/app')
}
