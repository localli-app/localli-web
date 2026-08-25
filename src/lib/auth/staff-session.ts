import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'

/**
 * Business dashboard sessions. No passwords anywhere in this product — the real
 * entry point is a magic link, and this module is the half that runs AFTER the
 * link is opened: it issues and reads the `ll_staff` session cookie.
 *
 * For the demo the link step is stood in for by a dev-only route
 * (`/api/dev/login`), per planning/10-build-order.md. The session mechanism
 * itself is the real one, so wiring magic-link issuance later touches only the
 * route that calls `createStaffSession`.
 */

export const STAFF_COOKIE = 'll_staff'
const SESSION_DAYS = 30

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createStaffSession(staffId: string): Promise<string> {
  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)

  await db.insert(s.staffSessions).values({
    staffId,
    tokenHash: hash(token),
    expiresAt,
    usedAt: new Date(),
  })

  return token
}

export interface StaffSession {
  staffId: string
  staffName: string
  role: 'owner' | 'manager' | 'staff'
  businessId: string
  businessName: string
  businessSlug: string
  timezone: string
  currency: string
  isMobile: boolean
}

/**
 * Resolves the current session, or null. Every dashboard query must take its
 * businessId from HERE and never from a request parameter — that is the line
 * that prevents a cross-tenant leak.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const store = await cookies()
  const token = store.get(STAFF_COOKIE)?.value
  if (!token) return null

  const session = await db.query.staffSessions.findFirst({
    where: and(eq(s.staffSessions.tokenHash, hash(token)), gt(s.staffSessions.expiresAt, new Date())),
  })
  if (!session) return null

  const staffMember = await db.query.staff.findFirst({ where: eq(s.staff.id, session.staffId) })
  if (!staffMember || !staffMember.isActive) return null

  const business = await db.query.businesses.findFirst({
    where: eq(s.businesses.id, staffMember.businessId),
  })
  if (!business) return null

  return {
    staffId: staffMember.id,
    staffName: staffMember.name,
    role: staffMember.role,
    businessId: business.id,
    businessName: business.name,
    businessSlug: business.slug,
    timezone: business.timezone,
    currency: business.currency,
    isMobile: business.isMobileEnabled,
  }
}

export async function clearStaffSession(): Promise<void> {
  const store = await cookies()
  const token = store.get(STAFF_COOKIE)?.value
  if (token) {
    await db.delete(s.staffSessions).where(eq(s.staffSessions.tokenHash, hash(token)))
  }
  store.delete(STAFF_COOKIE)
}

export function staffCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
    secure: process.env.NODE_ENV === 'production',
  }
}
