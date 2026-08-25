import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { emailHasAccount, issueLoginToken, LOGIN_TOKEN_TTL_MINUTES } from '@/lib/auth/magic-link'
import { recordAuthEvent } from '@/lib/auth/audit'
import { clientIp, safeInternalPath } from '@/lib/auth/request-context'
import { verifyTurnstile } from '@/lib/auth/turnstile'
import { sendEmail } from '@/lib/email/send'
import { renderLoginLinkEmail } from '@/lib/email/templates/login-link'
import { appBaseUrl } from '@/lib/dashboard/links'

const bodySchema = z.object({
  email: z.email(),
  /** Where to land after verifying. Same-origin paths only. */
  next: z.string().max(200).optional(),
  /** Turnstile response, when bot protection is configured. */
  turnstileToken: z.string().max(4000).optional(),
})

/**
 * Requests a sign-in link. This is both signup and sign-in — the magic link
 * creates the account when there isn't one.
 *
 * ALWAYS responds the same way, whether or not the address has an account,
 * whether or not it is rate-limited, whether or not bot protection rejected it,
 * and whether or not delivery succeeded. Anything else confirms which addresses
 * are registered, or tells an attacker when they have been throttled.
 */
export async function POST(request: NextRequest) {
  const isJson = request.headers.get('content-type')?.includes('application/json')
  const raw = isJson
    ? await request.json().catch(() => ({}))
    : Object.fromEntries((await request.formData().catch(() => new FormData())).entries())

  const parsed = bodySchema.safeParse(raw)

  if (parsed.success) {
    await issueAndSend(parsed.data, request)
  }

  const wantsHtml = request.headers.get('accept')?.includes('text/html')
  if (wantsHtml) {
    const target = new URL('/app/check-inbox', appBaseUrl(request))
    if (parsed.success) target.searchParams.set('email', parsed.data.email)
    return Response.redirect(target, 303)
  }

  return new Response(null, { status: 204 })
}

async function issueAndSend(
  input: { email: string; next?: string; turnstileToken?: string },
  request: NextRequest,
) {
  const { email } = input
  const headers = request.headers
  const ip = clientIp(headers)

  // Bot protection first: it is the only thing standing between this endpoint
  // and being a mailer for someone else's spam, paid for with our sending
  // reputation. Inert until keys are configured.
  const turnstile = await verifyTurnstile(input.turnstileToken, ip)
  if (!turnstile.ok) {
    await recordAuthEvent({
      kind: 'link_rate_limited',
      email,
      headers,
      detail: { reason: `turnstile_${turnstile.reason}` },
    })
    return
  }

  const redirectTo = safeInternalPath(input.next)

  const issued = await issueLoginToken({
    email,
    redirectTo,
    ip,
    userAgent: headers.get('user-agent'),
  })

  if (!issued) {
    await recordAuthEvent({ kind: 'link_rate_limited', email, headers, detail: { reason: 'quota' } })
    return
  }

  const isNewAccount = !(await emailHasAccount(email))
  const url = new URL('/api/auth/business/verify', appBaseUrl(request))
  url.searchParams.set('token', issued.token)

  const message = renderLoginLinkEmail({
    url: url.toString(),
    isNewAccount,
    expiryMinutes: LOGIN_TOKEN_TTL_MINUTES,
  })

  const result = await sendEmail({ to: email, ...message })

  await recordAuthEvent({
    kind: 'link_requested',
    email,
    headers,
    // Never the token. Delivery outcome is recorded because a silent Postmark
    // outage would otherwise look identical to nobody signing up.
    detail: {
      isNewAccount,
      transport: result.transport,
      delivered: result.delivered,
      turnstile: turnstile.reason,
    },
  })
}
