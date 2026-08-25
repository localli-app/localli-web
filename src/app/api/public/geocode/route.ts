import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { handleRoute, ok } from '@/lib/api/respond'

/**
 * Mapbox proxy. The token is never exposed to the client.
 *
 * COSTS MONEY PER CALL. Debounce on the client to at most one call per 400ms.
 * Per-IP rate limiting still has to land before this URL is public — see
 * planning/06-architecture.md and the rate-limit table in the API spec.
 */

const geocodeSchema = z.object({
  query: z.string().trim().min(3).max(120),
  country: z.string().length(2).default('GB'),
})

export interface GeocodeResult {
  id: string
  label: string
  lat: number
  lng: number
  postcode: string | null
}

/**
 * Development fallback, used only when MAPBOX_TOKEN is unset. These are the
 * three suggestions drawn in artboard 1b, and they are chosen so the flow can
 * be exercised end to end without a Mapbox account: the first two are inside
 * Glow Studio's coverage, and the SE22 one is deliberately outside it so the
 * out-of-area screen (1c) is reachable.
 *
 * This is a demo affordance, NOT product behaviour. Set MAPBOX_TOKEN and this
 * path is never taken.
 */
const FALLBACK_RESULTS: GeocodeResult[] = [
  { id: 'fallback-elm-se13', label: '22 Elm Road, Lewisham, SE13 7AA', lat: 51.4557, lng: -0.014, postcode: 'SE13 7AA' },
  { id: 'fallback-elm-se3', label: '22 Elm Road, Blackheath, SE3 9BQ', lat: 51.4665, lng: 0.0079, postcode: 'SE3 9BQ' },
  { id: 'fallback-elmbourne-se22', label: '22 Elmbourne Road, East Dulwich, SE22 8AG', lat: 51.451, lng: -0.071, postcode: 'SE22 8AG' },
]

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = geocodeSchema.parse(await request.json())
    const token = process.env.MAPBOX_TOKEN

    if (!token) {
      const needle = body.query.toLowerCase()
      const results = FALLBACK_RESULTS.filter((r) => r.label.toLowerCase().includes(needle))
      return ok({
        results: results.length > 0 ? results : FALLBACK_RESULTS,
        source: 'fallback' as const,
      })
    }

    const url = new URL(
      `https://api.mapbox.com/search/geocode/v6/forward`,
    )
    url.searchParams.set('q', body.query)
    url.searchParams.set('country', body.country)
    url.searchParams.set('types', 'address')
    url.searchParams.set('limit', '5')
    url.searchParams.set('access_token', token)

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) {
      // Never surface an upstream error body to the client.
      return ok({ results: [], source: 'mapbox' as const })
    }

    const payload = (await response.json()) as {
      features?: {
        id?: string
        properties?: {
          full_address?: string
          name?: string
          coordinates?: { latitude: number; longitude: number }
          context?: { postcode?: { name?: string } }
        }
      }[]
    }

    const results: GeocodeResult[] = (payload.features ?? [])
      .map((feature, index) => {
        const props = feature.properties ?? {}
        const coords = props.coordinates
        if (!coords) return null
        return {
          id: feature.id ?? `mapbox-${index}`,
          label: props.full_address ?? props.name ?? '',
          lat: coords.latitude,
          lng: coords.longitude,
          postcode: props.context?.postcode?.name ?? null,
        }
      })
      .filter((r): r is GeocodeResult => r !== null && r.label.length > 0)

    return ok({ results, source: 'mapbox' as const })
  })
}
