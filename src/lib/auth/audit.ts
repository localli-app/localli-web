import { db } from '../db/client'
import * as s from '../db/schema'
import { clientIp } from './request-context'

/**
 * Append-only auth audit trail.
 *
 * planning/06-architecture.md asks for an audit log on PII access, not just
 * mutations, and the auth boundary is where that matters most: who asked for a
 * link, which links were consumed, which were rejected, what was exported.
 */

export type AuthEventKind =
  | 'link_requested'
  | 'link_rate_limited'
  | 'link_consumed'
  | 'link_rejected'
  | 'account_created'
  | 'session_revoked'
  | 'signed_out'
  | 'data_exported'
  | 'account_deleted'

export interface AuthEventInput {
  kind: AuthEventKind
  email?: string | null
  staffId?: string | null
  businessId?: string | null
  headers?: Headers
  /** Must never contain a token, a session value, or any other secret. */
  detail?: Record<string, unknown>
}

/**
 * Records an event. Deliberately swallows its own failures: an audit write
 * going wrong must never be the reason someone cannot sign in. A dropped row
 * is logged loudly instead so the gap is visible.
 */
export async function recordAuthEvent(input: AuthEventInput): Promise<void> {
  try {
    await db.insert(s.authEvents).values({
      kind: input.kind,
      email: input.email ?? null,
      staffId: input.staffId ?? null,
      businessId: input.businessId ?? null,
      ip: input.headers ? clientIp(input.headers) : null,
      userAgent: input.headers?.get('user-agent')?.slice(0, 400) ?? null,
      detail: input.detail ?? null,
    })
  } catch (error) {
    console.error(`Failed to record auth event "${input.kind}":`, error)
  }
}
