/**
 * Cloudflare Turnstile, in invisible mode.
 *
 * The signup endpoint sends email to whatever address it is handed, which makes
 * it the most directly abusable surface in the product: unchecked, it is a
 * mailer for someone else's spam, paid for with our sending reputation.
 * Per-address limits stop one victim being bombed; they do nothing about
 * volume across many addresses. That is the gap this closes.
 *
 * Inert until configured, matching how email delivery behaves — the code is
 * complete and switches on when the keys appear, with no code change.
 *
 * planning/06-architecture.md: the customer must never see a visible challenge.
 * If one ever appears in normal use, treat it as a defect.
 */

const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null
}

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && turnstileSiteKey())
}

export interface TurnstileOutcome {
  /** True when the request may proceed. */
  ok: boolean
  /** Why it was allowed or refused, for the audit trail. Never a token. */
  reason: 'not_configured' | 'passed' | 'missing_token' | 'rejected' | 'unavailable'
}

/**
 * Verifies a Turnstile token.
 *
 * Two judgement calls worth stating, because they trade security against
 * locking real people out:
 *
 *   - Unconfigured means allow. Otherwise adding this file would silently
 *     break signup everywhere it has no keys, including local development.
 *   - Cloudflare being unreachable means allow, and says so in the reason.
 *     Their outage should not take signup down with it; the per-address and
 *     per-IP limits still apply underneath. Flip this to deny if abuse ever
 *     outweighs availability.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileOutcome> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret || !turnstileSiteKey()) return { ok: true, reason: 'not_configured' }

  if (!token) return { ok: false, reason: 'missing_token' }

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return { ok: true, reason: 'unavailable' }

    const payload = (await response.json()) as { success?: boolean }
    return payload.success ? { ok: true, reason: 'passed' } : { ok: false, reason: 'rejected' }
  } catch {
    return { ok: true, reason: 'unavailable' }
  }
}
