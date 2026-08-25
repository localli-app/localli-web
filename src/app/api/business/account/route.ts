import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import {
  clearStaffSession,
  FRESH_SESSION_MINUTES,
  getStaffSession,
} from '@/lib/auth/staff-session'
import { recordAuthEvent } from '@/lib/auth/audit'
import { deleteBusinessAccount } from '@/lib/dashboard/account'
import { AppError } from '@/lib/errors'

const confirmSchema = z.object({
  /** Typing the slug is the confirmation. Nothing is deleted on a stray click. */
  confirmSlug: z.string().trim().min(1),
})

/**
 * Permanently deletes the business.
 *
 * Requires a FRESH session, per the escalation rule in
 * planning/06-architecture.md: viewing needs only the token, but destroying the
 * account needs a recent login. A month-old cookie on an unattended laptop must
 * not be enough.
 */
export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    if (session.role !== 'owner') {
      return failure(new AppError('NOT_FOUND', 'Only the owner can delete the business.'))
    }

    const body = confirmSchema.parse(await request.json())
    if (body.confirmSlug !== session.businessSlug) {
      return failure(
        new AppError('VALIDATION_FAILED', `Type "${session.businessSlug}" exactly to confirm.`),
      )
    }

    if (!session.isFresh) {
      return failure(
        new AppError(
          'TOKEN_EXPIRED',
          `For safety this needs a fresh sign-in. Request a new link and try again within ${FRESH_SESSION_MINUTES} minutes.`,
          { needsReauth: true },
          // 403, not the code's default 404: the caller is authenticated and
          // the resource plainly exists — they simply signed in too long ago.
          403,
        ),
      )
    }

    // Recorded BEFORE the delete, and auth_event deliberately has no foreign
    // key to business, so the record that this happened outlives the business.
    await recordAuthEvent({
      kind: 'account_deleted',
      email: session.staffEmail,
      staffId: session.staffId,
      businessId: session.businessId,
      headers: request.headers,
      detail: { slug: session.businessSlug },
    })

    await deleteBusinessAccount(session.businessId)
    await clearStaffSession()

    return ok({ deleted: true })
  })
}
