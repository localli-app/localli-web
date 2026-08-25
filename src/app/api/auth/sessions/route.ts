import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { failure, handleRoute, ok } from '@/lib/api/respond'
import {
  getStaffSession,
  listStaffSessions,
  revokeAllStaffSessions,
  revokeStaffSession,
} from '@/lib/auth/staff-session'
import { recordAuthEvent } from '@/lib/auth/audit'
import { AppError } from '@/lib/errors'

export async function GET() {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    const sessions = await listStaffSessions(session.staffId, session.sessionId)
    return ok({
      sessions: sessions.map((s) => ({
        id: s.id,
        issuedAt: s.issuedAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        ip: s.ip,
        userAgent: s.userAgent,
        isCurrent: s.isCurrent,
      })),
    })
  })
}

const deleteSchema = z.object({
  /** Omit to sign out every OTHER device, keeping this one signed in. */
  sessionId: z.uuid().optional(),
})

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const session = await getStaffSession()
    if (!session) return failure(new AppError('INVALID_TOKEN', 'Sign in first.'))

    const body = deleteSchema.parse(await request.json().catch(() => ({})))

    if (body.sessionId) {
      const revoked = await revokeStaffSession(session.staffId, body.sessionId)
      if (!revoked) return failure(new AppError('NOT_FOUND', 'That session is already signed out.'))

      await recordAuthEvent({
        kind: 'session_revoked',
        email: session.staffEmail,
        staffId: session.staffId,
        businessId: session.businessId,
        headers: request.headers,
        detail: { scope: 'one', wasCurrent: body.sessionId === session.sessionId },
      })
      return ok({ revoked: 1 })
    }

    const count = await revokeAllStaffSessions(session.staffId, session.sessionId)
    await recordAuthEvent({
      kind: 'session_revoked',
      email: session.staffEmail,
      staffId: session.staffId,
      businessId: session.businessId,
      headers: request.headers,
      detail: { scope: 'others', count },
    })
    return ok({ revoked: count })
  })
}
