import type { NextRequest } from 'next/server'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { getStaffSession } from '@/lib/auth/staff-session'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { AppError } from '@/lib/errors'
import { weeklyHoursSchema } from '@/lib/validation/business'

export async function GET() {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    const rows = await db
      .select()
      .from(s.businessHours)
      .where(eq(s.businessHours.businessId, session.businessId))
      .orderBy(asc(s.businessHours.weekday))

    return ok({
      hours: rows.map((h) => ({
        weekday: h.weekday,
        opensLocal: h.opensLocal.slice(0, 5),
        closesLocal: h.closesLocal.slice(0, 5),
      })),
    })
  })
}

/**
 * Replaces the whole weekly set in one call. Simpler than per-row CRUD, and it
 * matches how the UI edits it — a closed day is an absent row, not a flag.
 */
export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    const body = weeklyHoursSchema.parse(await request.json())

    await db.transaction(async (tx) => {
      await tx.delete(s.businessHours).where(eq(s.businessHours.businessId, session.businessId))

      if (body.hours.length > 0) {
        await tx.insert(s.businessHours).values(
          body.hours.map((h) => ({
            businessId: session.businessId,
            weekday: h.weekday,
            opensLocal: h.opensLocal,
            closesLocal: h.closesLocal,
          })),
        )
      }

      // Staff hours are intersected with business hours, so an owner whose
      // pattern still matches the old business hours would silently lose
      // availability. Keep a solo owner's own hours in step with the business.
      const staffRows = await tx
        .select({ id: s.staff.id })
        .from(s.staff)
        .where(eq(s.staff.businessId, session.businessId))

      if (staffRows.length === 1) {
        const onlyStaffId = staffRows[0].id
        await tx.delete(s.staffHours).where(inArray(s.staffHours.staffId, [onlyStaffId]))
        if (body.hours.length > 0) {
          await tx.insert(s.staffHours).values(
            body.hours.map((h) => ({
              staffId: onlyStaffId,
              weekday: h.weekday,
              startsLocal: h.opensLocal,
              endsLocal: h.closesLocal,
            })),
          )
        }
      }

      await tx
        .update(s.businesses)
        .set({
          availabilityVersion: sql`${s.businesses.availabilityVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(s.businesses.id, session.businessId))
    })

    return ok({ hours: body.hours.length })
  })
}
