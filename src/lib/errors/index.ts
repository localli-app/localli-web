/**
 * Typed application errors with machine-readable codes.
 * A database message or stack trace must never reach a client.
 * Codes are stable and mirror planning/09-api-spec.md.
 */

export type AppErrorCode =
  | 'SLOT_TAKEN'
  | 'OUT_OF_AREA'
  | 'OUTSIDE_HOURS'
  | 'TOO_SOON'
  | 'TOO_FAR_AHEAD'
  | 'TRAVEL_INFEASIBLE'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'BUSINESS_INACTIVE'
  | 'POLICY_WINDOW_PASSED'
  | 'NOT_FOUND'
  | 'INTERNAL'

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  SLOT_TAKEN: 409,
  OUT_OF_AREA: 422,
  OUTSIDE_HOURS: 422,
  TOO_SOON: 422,
  TOO_FAR_AHEAD: 422,
  TRAVEL_INFEASIBLE: 422,
  INVALID_TOKEN: 404,
  TOKEN_EXPIRED: 404,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BUSINESS_INACTIVE: 404,
  POLICY_WINDOW_PASSED: 422,
  NOT_FOUND: 404,
  INTERNAL: 500,
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly status: number
  readonly details?: unknown

  /**
   * `status` overrides the code's default mapping. Needed because a few codes
   * mean different things on public and authenticated endpoints: TOKEN_EXPIRED
   * is 404 on a public booking link, deliberately, so a probe cannot learn that
   * the token format was right — but 404 is simply wrong when an authenticated
   * owner is told their session is too old for a privileged action.
   */
  constructor(code: AppErrorCode, message: string, details?: unknown, status?: number) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status ?? STATUS_BY_CODE[code]
    this.details = details
  }
}

export function statusForCode(code: AppErrorCode): number {
  return STATUS_BY_CODE[code]
}
