import { createHash, randomBytes } from 'node:crypto'
import { and, count, eq, gt, gte, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'
import { normaliseEmail } from '../identity/normalise'

/**
 * Magic-link issuance and consumption for the business side.
 *
 * Rules from planning/06-architecture.md, all enforced here rather than at the
 * route so they cannot be skipped by a new caller:
 *   - Tokens are single-use and hashed at rest. The raw value is returned once.
 *   - Login links expire in 15 minutes.
 *   - Issuance is rate-limited per address and per IP, so nobody can be spammed
 *     with sign-in emails.
 */

export const LOGIN_TOKEN_TTL_MINUTES = 15

/** planning/09-api-spec.md: 3 per 10 minutes per address, 10 per hour per IP. */
const MAX_PER_ADDRESS = 3
const ADDRESS_WINDOW_MINUTES = 10
const MAX_PER_IP = 10
const IP_WINDOW_MINUTES = 60

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface IssueResult {
  /** Raw token, returned once. Never stored. */
  token: string
  expiresAt: Date
}

/**
 * Issues a login token, or returns null when the caller is over a rate limit.
 *
 * A null return must NOT change what the endpoint tells the user: responding
 * differently would confirm whether an address is registered, or that they are
 * being throttled.
 */
export async function issueLoginToken(input: {
  email: string
  redirectTo?: string | null
  ip?: string | null
  userAgent?: string | null
}): Promise<IssueResult | null> {
  const email = normaliseEmail(input.email)
  if (!email) return null

  const now = new Date()
  const addressSince = new Date(now.getTime() - ADDRESS_WINDOW_MINUTES * 60_000)
  const ipSince = new Date(now.getTime() - IP_WINDOW_MINUTES * 60_000)

  const [addressUsage] = await db
    .select({ n: count() })
    .from(s.authLoginTokens)
    .where(and(eq(s.authLoginTokens.email, email), gte(s.authLoginTokens.createdAt, addressSince)))

  if (Number(addressUsage?.n ?? 0) >= MAX_PER_ADDRESS) return null

  if (input.ip) {
    const [ipUsage] = await db
      .select({ n: count() })
      .from(s.authLoginTokens)
      .where(and(eq(s.authLoginTokens.ip, input.ip), gte(s.authLoginTokens.createdAt, ipSince)))

    if (Number(ipUsage?.n ?? 0) >= MAX_PER_IP) return null
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now.getTime() + LOGIN_TOKEN_TTL_MINUTES * 60_000)

  await db.insert(s.authLoginTokens).values({
    email,
    tokenHash: hash(token),
    expiresAt,
    redirectTo: input.redirectTo ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  })

  return { token, expiresAt }
}

export interface ConsumedToken {
  email: string
  redirectTo: string | null
}

/**
 * Validates and burns a token. Returns null for anything not currently valid —
 * unknown, expired, or already used — without distinguishing between them.
 *
 * The update is conditional on the token still being unused, so two concurrent
 * requests with the same link cannot both succeed.
 */
export async function consumeLoginToken(token: string): Promise<ConsumedToken | null> {
  if (!token) return null

  const [row] = await db
    .update(s.authLoginTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(s.authLoginTokens.tokenHash, hash(token)),
        isNull(s.authLoginTokens.usedAt),
        gt(s.authLoginTokens.expiresAt, new Date()),
      ),
    )
    .returning({
      email: s.authLoginTokens.email,
      redirectTo: s.authLoginTokens.redirectTo,
    })

  if (!row) return null
  return { email: row.email, redirectTo: row.redirectTo }
}

/** True when this address already has a staff record, i.e. signing in rather than signing up. */
export async function emailHasAccount(email: string): Promise<boolean> {
  const normalised = normaliseEmail(email)
  if (!normalised) return false

  const existing = await db.query.staff.findFirst({
    where: and(eq(s.staff.email, normalised), eq(s.staff.isActive, true)),
  })
  return Boolean(existing)
}
