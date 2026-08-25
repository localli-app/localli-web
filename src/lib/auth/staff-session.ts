import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'
import { clientIp } from './request-context'

/**
 * Business dashboard sessions. No passwords anywhere in this product — the real
 * entry point is a magic link, and this module is the half that runs AFTER the
 * link is opened: it issues, reads, and revokes the `ll_staff` session cookie.
 */

export const STAFF_COOKIE = 'll_staff'
const SESSION_DAYS = 30

/**
 * How recently a session must have been established to perform something
 * destructive. planning/06-architecture.md: viewing needs only the token,
 * but deleting an account requires a fresh login. A month-old cookie on an
 * unattended laptop must not be enough to erase the business.
 */
export const FRESH_SESSION_MINUTES = 15

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createStaffSession(
  staffId: string,
  context?: { headers?: Headers },
): Promise<string> {
  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)

  await db.insert(s.staffSessions).values({
    staffId,
    tokenHash: hash(token),
    expiresAt,
    usedAt: new Date(),
    ip: context?.headers ? clientIp(context.headers) : null,
    userAgent: context?.headers?.get('user-agent')?.slice(0, 400) ?? null,
  })

  return token
}

export interface StaffSession {
  sessionId: string
  staffId: string
  staffName: string
  staffEmail: string | null
  role: 'owner' | 'manager' | 'staff'
  businessId: string
  businessName: string
  businessSlug: string
  timezone: string
  currency: string
  isMobile: boolean
  /** True when this session was established recently enough for a destructive action. */
  isFresh: boolean
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
    where: and(
      eq(s.staffSessions.tokenHash, hash(token)),
      gt(s.staffSessions.expiresAt, new Date()),
      isNull(s.staffSessions.revokedAt),
    ),
  })
  if (!session) return null

  const staffMember = await db.query.staff.findFirst({ where: eq(s.staff.id, session.staffId) })
  if (!staffMember || !staffMember.isActive) return null

  const business = await db.query.businesses.findFirst({
    where: eq(s.businesses.id, staffMember.businessId),
  })
  if (!business) return null

  // Cheap enough to do inline, and it is what makes the sessions screen
  // meaningful. Throttled to a minute so a busy dashboard is not writing on
  // every request.
  const staleBy = Date.now() - session.lastSeenAt.getTime()
  if (staleBy > 60_000) {
    await db
      .update(s.staffSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(s.staffSessions.id, session.id))
      .catch(() => {})
  }

  const ageMinutes = (Date.now() - session.issuedAt.getTime()) / 60_000

  return {
    sessionId: session.id,
    staffId: staffMember.id,
    staffName: staffMember.name,
    staffEmail: staffMember.email,
    role: staffMember.role,
    businessId: business.id,
    businessName: business.name,
    businessSlug: business.slug,
    timezone: business.timezone,
    currency: business.currency,
    isMobile: business.isMobileEnabled,
    isFresh: ageMinutes <= FRESH_SESSION_MINUTES,
  }
}

export async function clearStaffSession(): Promise<void> {
  const store = await cookies()
  const token = store.get(STAFF_COOKIE)?.value
  if (token) {
    // Revoked, not deleted: the sessions screen and the audit trail should
    // still be able to say this device was signed out, and when.
    await db
      .update(s.staffSessions)
      .set({ revokedAt: new Date() })
      .where(eq(s.staffSessions.tokenHash, hash(token)))
  }
  store.delete(STAFF_COOKIE)
}

export interface SessionSummary {
  id: string
  issuedAt: Date
  lastSeenAt: Date
  expiresAt: Date
  ip: string | null
  userAgent: string | null
  isCurrent: boolean
}

/** Active sessions for one staff member, newest first. */
export async function listStaffSessions(
  staffId: string,
  currentSessionId: string,
): Promise<SessionSummary[]> {
  const rows = await db
    .select()
    .from(s.staffSessions)
    .where(
      and(
        eq(s.staffSessions.staffId, staffId),
        gt(s.staffSessions.expiresAt, new Date()),
        isNull(s.staffSessions.revokedAt),
      ),
    )
    .orderBy(desc(s.staffSessions.lastSeenAt))

  return rows.map((row) => ({
    id: row.id,
    issuedAt: row.issuedAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
    ip: row.ip,
    userAgent: row.userAgent,
    isCurrent: row.id === currentSessionId,
  }))
}

/** Revokes one session. Scoped by staffId so nobody can revoke someone else's. */
export async function revokeStaffSession(staffId: string, sessionId: string): Promise<boolean> {
  const revoked = await db
    .update(s.staffSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(s.staffSessions.id, sessionId),
        eq(s.staffSessions.staffId, staffId),
        isNull(s.staffSessions.revokedAt),
      ),
    )
    .returning({ id: s.staffSessions.id })

  return revoked.length > 0
}

/**
 * Signs out everywhere. `exceptSessionId` keeps the current device signed in,
 * which is what someone wants after losing a phone — otherwise the useful
 * action also locks them out of the device they are holding.
 */
export async function revokeAllStaffSessions(
  staffId: string,
  exceptSessionId?: string,
): Promise<number> {
  const revoked = await db
    .update(s.staffSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(s.staffSessions.staffId, staffId),
        isNull(s.staffSessions.revokedAt),
        exceptSessionId ? sql`${s.staffSessions.id} <> ${exceptSessionId}` : undefined,
      ),
    )
    .returning({ id: s.staffSessions.id })

  return revoked.length
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

/**
 * Deletes spent login tokens and long-dead sessions.
 *
 * Both tables only ever grew. Neither is enormous, but an auth table that
 * accumulates every request forever is a slow leak and a widening blast radius
 * if it is ever read out.
 */
export async function purgeExpiredAuthRows(now = new Date()): Promise<{
  tokens: number
  sessions: number
}> {
  const tokenCutoff = new Date(now.getTime() - 24 * 3_600_000)
  // Keep revoked and expired sessions around for a while: they are the
  // evidence behind "signed out from the salon iPad".
  const sessionCutoff = new Date(now.getTime() - 30 * 86_400_000)

  const tokens = await db
    .delete(s.authLoginTokens)
    .where(
      or(
        lt(s.authLoginTokens.expiresAt, tokenCutoff),
        and(
          sql`${s.authLoginTokens.usedAt} is not null`,
          lt(s.authLoginTokens.usedAt, tokenCutoff),
        ),
      ),
    )
    .returning({ id: s.authLoginTokens.id })

  const sessions = await db
    .delete(s.staffSessions)
    .where(
      or(
        lt(s.staffSessions.expiresAt, sessionCutoff),
        and(
          sql`${s.staffSessions.revokedAt} is not null`,
          lt(s.staffSessions.revokedAt, sessionCutoff),
        ),
      ),
    )
    .returning({ id: s.staffSessions.id })

  return { tokens: tokens.length, sessions: sessions.length }
}
