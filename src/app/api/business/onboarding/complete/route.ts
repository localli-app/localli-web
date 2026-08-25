import { eq } from 'drizzle-orm'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { getStaffSession } from '@/lib/auth/staff-session'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { AppError } from '@/lib/errors'

/** Marks the wizard finished, which retires the "finish setting up" prompt. */
export async function POST() {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    await db
      .update(s.businesses)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(s.businesses.id, session.businessId))

    return ok({ completed: true })
  })
}
