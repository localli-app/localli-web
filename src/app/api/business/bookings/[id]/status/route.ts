import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import { getStaffSession } from '@/lib/auth/staff-session'
import { transitionBooking } from '@/lib/dashboard/transitions'
import { AppError } from '@/lib/errors'

const bodySchema = z.object({
  status: z.enum(['completed', 'no_show', 'in_progress', 'cancelled_by_business']),
  note: z.string().trim().max(500).optional(),
})

export async function POST(request: NextRequest, ctx: RouteContext<'/api/business/bookings/[id]/status'>) {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) {
      return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))
    }

    const { id } = await ctx.params
    const body = bodySchema.parse(await request.json())

    const result = await transitionBooking({
      businessId: session.businessId,
      bookingId: id,
      to: body.status,
      actorStaffId: session.staffId,
      note: body.note,
    })

    return ok(result)
  })
}
