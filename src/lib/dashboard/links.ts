import type { NextRequest } from 'next/server'

/**
 * The public origin the booking links point at. Prefers the configured value so
 * a QR printed today keeps working when the host changes.
 */
export function appBaseUrl(request?: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (configured) return configured
  if (request) return request.nextUrl.origin
  return 'http://localhost:3000'
}

/** The link as an owner should read it: no scheme, no trailing slash. */
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
