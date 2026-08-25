import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { emailHasAccount, issueLoginToken, LOGIN_TOKEN_TTL_MINUTES } from '@/lib/auth/magic-link'
import { sendEmail } from '@/lib/email/send'
import { renderLoginLinkEmail } from '@/lib/email/templates/login-link'
import { appBaseUrl } from '@/lib/dashboard/links'

const bodySchema = z.object({
  email: z.email(),
  /** Where to land after verifying. Same-origin paths only. */
  next: z.string().max(200).optional(),
})

/**
 * Requests a sign-in link. This is both signup and sign-in — the magic link
 * creates the account if there isn't one.
 *
 * ALWAYS responds the same way, whether or not the address has an account,
 * whether or not it is rate-limited, and whether or not delivery succeeded.
 * Anything else confirms which addresses are registered.
 */
export async function POST(request: NextRequest) {
  const form = request.headers.get('content-type')?.includes('application/json')
    ? await request.json().catch(() => ({}))
    : Object.fromEntries((await request.formData().catch(() => new FormData())).entries())

  const parsed = bodySchema.safeParse(form)

  // Even a malformed address gets the same outcome, so probing learns nothing.
  if (parsed.success) {
    await issueAndSend(parsed.data.email, parsed.data.next ?? null, request)
  }

  // A browser form post lands on the "check your inbox" screen; an API caller
  // gets 204, per planning/09-api-spec.md.
  const wantsHtml = request.headers.get('accept')?.includes('text/html')
  if (wantsHtml) {
    const target = new URL('/app/check-inbox', appBaseUrl(request))
    if (parsed.success) target.searchParams.set('email', parsed.data.email)
    return Response.redirect(target, 303)
  }

  return new Response(null, { status: 204 })
}

async function issueAndSend(email: string, next: string | null, request: NextRequest) {
  // Only same-origin paths, so a link cannot be used to bounce someone offsite.
  const redirectTo = next && next.startsWith('/') && !next.startsWith('//') ? next : null

  const issued = await issueLoginToken({
    email,
    redirectTo,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  })

  // Over a rate limit. Silently do nothing: the caller must not be able to tell.
  if (!issued) return

  const isNewAccount = !(await emailHasAccount(email))
  const url = new URL('/api/auth/business/verify', appBaseUrl(request))
  url.searchParams.set('token', issued.token)

  const message = renderLoginLinkEmail({
    url: url.toString(),
    isNewAccount,
    expiryMinutes: LOGIN_TOKEN_TTL_MINUTES,
  })

  await sendEmail({ to: email, ...message })
}
