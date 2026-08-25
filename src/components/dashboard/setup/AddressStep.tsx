'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { WizardActions } from '../wizard'

interface GeocodeResult {
  id: string
  label: string
  lat: number
  lng: number
  postcode?: string | null
}

const RADIUS_CHOICES = [
  { metres: 3000, label: '3 km' },
  { metres: 5000, label: '5 km' },
  { metres: 8000, label: '8 km' },
  { metres: 16000, label: '16 km' },
]

/**
 * Step 3. For a premises business this is where clients come; for a mobile one
 * it is where the day starts and ends, plus how far they will travel.
 *
 * Geocoding is attempted but never required: an address with no coordinates
 * still saves, and the travel model degrades rather than blocking setup.
 */
export function AddressStep({
  isMobile,
  initial,
  initialRadiusMetres,
}: {
  isMobile: boolean
  initial: { line1: string; city: string | null; postcode: string | null } | null
  initialRadiusMetres: number | null
}) {
  const router = useRouter()
  const [line1, setLine1] = useState(initial?.line1 ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [postcode, setPostcode] = useState(initial?.postcode ?? '')
  const [radius, setRadius] = useState(initialRadiusMetres ?? 5000)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [matches, setMatches] = useState<GeocodeResult[] | null>(null)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function findOnMap() {
    const query = [line1, city, postcode].filter(Boolean).join(', ').trim()
    if (!query) return

    setLocating(true)
    setMatches(null)
    try {
      const response = await fetch('/api/public/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, country: 'GB' }),
      })
      const payload = await response.json()
      setMatches(response.ok ? (payload?.data?.results ?? []) : [])
    } catch {
      setMatches([])
    } finally {
      setLocating(false)
    }
  }

  function choose(result: GeocodeResult) {
    setCoords({ lat: result.lat, lng: result.lng })
    if (result.postcode) setPostcode(result.postcode)
    setMatches(null)
  }

  /** Resolves coordinates without user interaction, for the save path. */
  async function autoLocate(): Promise<{ lat: number; lng: number } | null> {
    const query = [line1, city, postcode].filter(Boolean).join(', ').trim()
    if (!query) return null
    try {
      const response = await fetch('/api/public/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, country: 'GB' }),
      })
      if (!response.ok) return null
      const payload = await response.json()
      const first = payload?.data?.results?.[0]
      return first ? { lat: first.lat, lng: first.lng } : null
    } catch {
      return null
    }
  }

  async function save() {
    setError(null)
    if (!line1.trim()) {
      setError('We need at least a street address.')
      return
    }

    setSaving(true)
    try {
      // A radius is meaningless without a centre, so for a mobile business try
      // to resolve coordinates before saving rather than dropping the choice
      // they just made on the floor.
      let position = coords
      if (isMobile && !position) {
        position = await autoLocate()
        if (position) setCoords(position)
      }

      const response = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: {
            line1: line1.trim(),
            city: city.trim() || null,
            postcode: postcode.trim() || null,
            lat: position?.lat ?? null,
            lng: position?.lng ?? null,
          },
          // Only send a radius we can actually anchor.
          ...(isMobile && position ? { serviceRadiusMetres: radius } : {}),
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload?.error?.message ?? 'That did not save.')
        return
      }

      // Saying so is better than letting them believe a travel area is set.
      // The address is saved either way, so this is a nudge, not a dead end.
      if (isMobile && !position) {
        router.push('/app/setup/hours?unpinned=1')
        return
      }
      router.push('/app/setup/hours')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  const field =
    'h-12 w-full rounded-[10px] bg-field px-3.5 text-[16px] text-ink outline-none placeholder:text-ink-faint'

  return (
    <>
      <div className="mt-[26px] rounded-[14px] border border-hairline bg-surface p-[22px]">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[14px] text-ink-secondary">
              {isMobile ? 'Where you start your day' : 'Street address'}
            </span>
            <input
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              autoFocus
              placeholder="14 Mill Lane"
              className={field}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-[14px] text-ink-secondary">Town or city</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="London"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[14px] text-ink-secondary">Postcode</span>
              <input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="SE13 7HZ"
                className={field}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={findOnMap}
              disabled={locating || !line1.trim()}
              className="flex min-h-[40px] items-center rounded-[10px] border border-ink/15 px-3.5 text-[14px] font-semibold text-ink transition-colors hover:bg-field disabled:opacity-40"
            >
              {locating ? 'Looking…' : 'Find on the map'}
            </button>
            {coords && (
              <span className="text-[13px] text-status-confirmed">
                Pinned — travel times will be accurate.
              </span>
            )}
          </div>

          {matches !== null && (
            <div className="flex flex-col rounded-[10px] border border-hairline">
              {matches.length === 0 ? (
                <p className="p-3.5 text-[14px] leading-[1.5] text-ink-muted">
                  No match. You can still continue — we&rsquo;ll save the address as typed and you
                  can pin it later.
                </p>
              ) : (
                matches.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => choose(result)}
                    className="min-h-[48px] border-b border-hairline-soft px-3.5 py-3 text-left text-[15px] text-ink last:border-b-0 hover:bg-surface-subtle"
                  >
                    {result.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {isMobile && (
          <div className="mt-6 border-t border-hairline pt-5">
            <p className="text-[14px] text-ink-secondary">How far will you travel?</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {RADIUS_CHOICES.map((choice) => {
                const selected = radius === choice.metres
                return (
                  <button
                    key={choice.metres}
                    type="button"
                    onClick={() => setRadius(choice.metres)}
                    className={`flex min-h-[44px] items-center rounded-[10px] border px-4 text-[15px] font-semibold transition-colors ${
                      selected
                        ? 'border-accent bg-accent text-white'
                        : 'border-ink/15 text-ink hover:bg-field'
                    }`}
                  >
                    {choice.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-[13px] leading-[1.5] text-ink-muted">
              You can change this any time. Customers outside it are told you don&rsquo;t cover
              them yet, and we log where they asked from.
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-[14px] text-status-noshow">{error}</p>}

      <WizardActions skipHref="/app/setup/hours">
        <button
          type="button"
          onClick={save}
          disabled={saving || !line1.trim()}
          className="flex h-[46px] items-center rounded-[11px] bg-accent px-[26px] text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </WizardActions>
    </>
  )
}
