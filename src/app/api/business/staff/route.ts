import type { NextRequest } from 'next/server'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { getStaffSession } from '@/lib/auth/staff-session'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { AppError } from '@/lib/errors'
import { addStaffSchema } from '@/lib/validation/business'
import { normaliseEmail } from '@/lib/identity/normalise'

/** Adds team members during the wizard, inheriting the business's hours and services. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    const body = addStaffSchema.parse(await request.json())
    if (body.staff.length === 0) return ok({ created: 0 })

    const [hours, services, existing] = await Promise.all([
      db.select().from(s.businessHours).where(eq(s.businessHours.businessId, session.businessId)),
      db.select({ id: s.services.id }).from(s.services).where(eq(s.services.businessId, session.businessId)),
      db.select({ id: s.staff.id }).from(s.staff).where(eq(s.staff.businessId, session.businessId)).orderBy(asc(s.staff.sortOrder)),
    ])

    // One account per email is now enforced by a unique index, so a clash here
    // must read as a message rather than a 500. It happens for real: a stylist
    // who already has their own Localli account being added to a second salon.
    const withEmail = body.staff
      .map((m) => (m.email ? normaliseEmail(m.email) : null))
      .filter((e): e is string => Boolean(e))

    if (withEmail.length > 0) {
      const clashes = await db
        .select({ email: s.staff.email })
        .from(s.staff)
        .where(and(inArray(s.staff.email, withEmail), eq(s.staff.isActive, true)))

      if (clashes.length > 0) {
        throw new AppError(
          'VALIDATION_FAILED',
          `${clashes[0].email} is already used by another Localli account. Add them without an email for now, or use a different address.`,
          { field: 'email', conflicts: clashes.map((c) => c.email) },
        )
      }
    }

    const created = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(s.staff)
        .values(
          body.staff.map((member, index) => ({
            businessId: session.businessId,
            name: member.name,
            email: member.email ? normaliseEmail(member.email) : null,
            role: 'staff' as const,
            isBookable: member.isBookable,
            sortOrder: existing.length + index,
          })),
        )
        .returning({ id: s.staff.id })

      // Without hours they are bookable in name only, and without a service
      // link nothing can be booked with them.
      if (hours.length > 0) {
        await tx.insert(s.staffHours).values(
          rows.flatMap((row) =>
            hours.map((h) => ({
              staffId: row.id,
              weekday: h.weekday,
              startsLocal: h.opensLocal,
              endsLocal: h.closesLocal,
            })),
          ),
        )
      }

      if (services.length > 0) {
        await tx.insert(s.serviceStaff).values(
          rows.flatMap((row) => services.map((svc) => ({ serviceId: svc.id, staffId: row.id }))),
        )
      }

      await tx
        .update(s.businesses)
        .set({ availabilityVersion: sql`${s.businesses.availabilityVersion} + 1`, updatedAt: new Date() })
        .where(eq(s.businesses.id, session.businessId))

      return rows
    })

    return ok({ created: created.length })
  })
}
