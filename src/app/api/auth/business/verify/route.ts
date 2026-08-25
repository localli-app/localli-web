import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createStaffSession, STAFF_COOKIE, staffCookieOptions } from '@/lib/auth/staff-session'
import { consumeLoginToken } from '@/lib/auth/magic-link'
import { recordAuthEvent } from '@/lib/auth/audit'
import { safeInternalPath } from '@/lib/auth/request-context'
import { resolveOrCreateAccount } from '@/lib/auth/signup'

/**
 * Opens a magic link: burns the token, creates the account if this is the
 * first time, issues a session, and drops them straight into the wizard.
 *
 * This is the only place a business account is ever created, and the only
 * place verification happens.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  const consumed = token ? await consumeLoginToken(token) : null
  if (!consumed) {
    // Expired, already used, or never existed — all the same to the visitor.
    await recordAuthEvent({
      kind: 'link_rejected',
      headers: request.headers,
      detail: { hadToken: Boolean(token) },
    })
    redirect('/app/signin?expired=1')
  }

  let account
  try {
    account = await resolveOrCreateAccount(consumed.email)
  } catch (error) {
    // The token is already spent, so failing here would strand them with a
    // dead link and no explanation. Send them back with a retryable message
    // rather than an unhandled 500.
    console.error('Account resolution failed during verify:', error)
    await recordAuthEvent({
      kind: 'link_rejected',
      email: consumed.email,
      headers: request.headers,
      detail: { reason: 'account_resolution_failed' },
    })
    redirect('/app/signin?error=1')
  }

  if (account.isNew) {
    await recordAuthEvent({
      kind: 'account_created',
      email: consumed.email,
      staffId: account.staffId,
      businessId: account.businessId,
      headers: request.headers,
    })
  }

  const sessionToken = await createStaffSession(account.staffId, { headers: request.headers })
  const store = await cookies()
  store.set(STAFF_COOKIE, sessionToken, staffCookieOptions())

  await recordAuthEvent({
    kind: 'link_consumed',
    email: consumed.email,
    staffId: account.staffId,
    businessId: account.businessId,
    headers: request.headers,
  })

  // A brand-new account goes to the wizard; a returning owner goes wherever
  // they were headed, or to Today. Re-validated here because the stored value
  // has been sitting in the database since the link was issued.
  const destination = account.onboardingComplete
    ? (safeInternalPath(consumed.redirectTo) ?? '/app')
    : '/app/setup/business'

  redirect(destination)
}
