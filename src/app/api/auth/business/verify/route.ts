import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createStaffSession, STAFF_COOKIE, staffCookieOptions } from '@/lib/auth/staff-session'
import { consumeLoginToken } from '@/lib/auth/magic-link'
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
    redirect('/app/signin?expired=1')
  }

  const account = await resolveOrCreateAccount(consumed.email)

  const sessionToken = await createStaffSession(account.staffId)
  const store = await cookies()
  store.set(STAFF_COOKIE, sessionToken, staffCookieOptions())

  // A brand-new account goes to the wizard; a returning owner goes wherever
  // they were headed, or to Today.
  const destination = account.onboardingComplete
    ? (consumed.redirectTo ?? '/app')
    : '/app/setup/business'

  redirect(destination)
}
