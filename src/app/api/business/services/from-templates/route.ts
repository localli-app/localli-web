import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { getStaffSession } from '@/lib/auth/staff-session'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { AppError } from '@/lib/errors'
import { findTemplate } from '@/lib/dashboard/service-templates'

const bodySchema = z.object({
  services: z
    .array(
      z.object({
        templateKey: z.string().min(1),
        priceMinor: z.int().positive(),
      }),
    )
    .min(1),
})

/** Creates services from the onboarding template picker. */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    const body = bodySchema.parse(await request.json())

    const resolved = body.services.map((entry) => {
      const template = findTemplate(entry.templateKey)
      if (!template) {
        throw new AppError('VALIDATION_FAILED', `Unknown service template: ${entry.templateKey}`)
      }
      return { ...template, priceMinor: entry.priceMinor }
    })

    const bookableStaff = await db
      .select({ id: s.staff.id })
      .from(s.staff)
      .where(eq(s.staff.businessId, session.businessId))

    const created = await db.transaction(async (tx) => {
      const [{ nextOrder }] = await tx
        .select({ nextOrder: sql<number>`coalesce(max(${s.services.sortOrder}), -1) + 1` })
        .from(s.services)
        .where(eq(s.services.businessId, session.businessId))

      const rows = await tx
        .insert(s.services)
        .values(
          resolved.map((entry, index) => ({
            businessId: session.businessId,
            category: entry.category.label,
            name: entry.service.name,
            durationMinutes: entry.service.durationMinutes,
            priceMinor: entry.priceMinor,
            rebookIntervalDays: entry.service.rebookIntervalDays ?? null,
            sortOrder: Number(nextOrder) + index,
            // Mobile work needs kit setup and pack-down, and it occupies the calendar.
            setupMinutes: session.isMobile ? 10 : 0,
            packdownMinutes: session.isMobile ? 10 : 0,
          })),
        )
        .returning({ id: s.services.id })

      // Without a service_staff link nobody can perform the service, so the
      // booking page would show it with no availability at all.
      if (bookableStaff.length > 0) {
        await tx.insert(s.serviceStaff).values(
          rows.flatMap((row) => bookableStaff.map((member) => ({ serviceId: row.id, staffId: member.id }))),
        )
      }

      // Anything that can change slots must invalidate cached availability.
      await tx
        .update(s.businesses)
        .set({ availabilityVersion: sql`${s.businesses.availabilityVersion} + 1`, updatedAt: new Date() })
        .where(eq(s.businesses.id, session.businessId))

      return rows
    })

    return ok({ created: created.length })
  })
}
