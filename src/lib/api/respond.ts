import { ZodError } from 'zod'
import { AppError } from '../errors'

/**
 * Every response is `{ data }` or `{ error: { code, message, details? } }`.
 * Never a bare array, never a bare object. See planning/09-api-spec.md.
 */

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { status: 200, ...init })
}

export function created<T>(data: T): Response {
  return Response.json({ data }, { status: 201 })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

export function failure(error: AppError): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    },
    { status: error.status },
  )
}

/**
 * Wraps a route handler so an AppError becomes its documented status and a Zod
 * failure becomes 422 with the issues attached. Anything unexpected is logged
 * server-side and returned as an opaque 500 — no stack traces to clients.
 */
export function handleRoute(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof AppError) return failure(e)
    if (e instanceof ZodError) {
      return failure(
        new AppError('VALIDATION_FAILED', 'Some of those details were not valid.', e.issues),
      )
    }
    console.error('Unhandled route error:', e)
    return failure(new AppError('INTERNAL', 'Something went wrong. Please try again.'))
  })
}
