'use client'

import { useEffect, useRef, useState } from 'react'
import type { GeocodeResult } from '@/app/api/public/geocode/route'
import { ActionBar, PrimaryButton, ScreenTitle } from './primitives'

export interface ChosenAddress {
  line1: string
  postcode: string | null
  lat: number
  lng: number
  accessNotes: string | null
}

/** Artboard 1b — address entry, with optional access details collapsed by default. */
export function AddressStep({
  businessSlug,
  businessName,
  onContinue,
}: {
  businessSlug: string
  businessName: string
  onContinue: (address: ChosenAddress) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [selected, setSelected] = useState<GeocodeResult | null>(null)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [accessNotes, setAccessNotes] = useState('')
  const [checking, setChecking] = useState(false)
  const [outOfArea, setOutOfArea] = useState<{ areaLabels: string[] } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Whether suggestions should show is derived, not stored — clearing results
  // from inside the effect would cause a cascading render on every keystroke.
  const showResults = !selected && query.trim().length >= 3 && results.length > 0

  useEffect(() => {
    if (selected || query.trim().length < 3) return

    // Geocoding costs money per call, so never fire on every keystroke.
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/public/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim(), country: 'GB' }),
        })
        if (!response.ok) return
        const payload = (await response.json()) as { data: { results: GeocodeResult[] } }
        setResults(payload.data.results)
      } catch {
        // A failed lookup must not break the flow; the customer can keep typing.
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selected])

  async function choose(result: GeocodeResult) {
    setSelected(result)
    setQuery(result.label)
    setResults([])
    setChecking(true)
    try {
      const response = await fetch('/api/public/service-area/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessSlug, lat: result.lat, lng: result.lng }),
      })
      const payload = (await response.json()) as {
        data?: { inArea: boolean; areaLabels: string[] }
      }
      if (payload.data && !payload.data.inArea) {
        setOutOfArea({ areaLabels: payload.data.areaLabels })
      }
    } catch {
      // Treat a check failure as "carry on" — availability re-checks the area
      // server-side anyway, so this cannot create an unserviceable booking.
    } finally {
      setChecking(false)
    }
  }

  function reset() {
    setOutOfArea(null)
    setSelected(null)
    setQuery('')
  }

  if (outOfArea) {
    return (
      <OutOfAreaScreen
        businessName={businessName}
        address={selected?.label ?? ''}
        postcodeArea={outOfArea.areaLabels}
        onChooseDifferent={reset}
      />
    )
  }

  return (
    <>
      <div className="px-5 pt-7">
        <ScreenTitle>Where should we come to you?</ScreenTitle>

        <label className="mt-[22px] block">
          <span className="sr-only">Your address</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="street-address"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(null)
            }}
            placeholder="Start typing your address"
            className="w-full rounded-[10px] bg-field px-3.5 py-3.5 text-[17px] leading-[1.2] text-ink placeholder:text-ink-muted focus:shadow-[0_0_0_4px_rgb(168_72_31/0.16)] focus:outline-none"
          />
        </label>

        {showResults ? (
          <ul className="mt-1.5 flex list-none flex-col p-0">
            {results.map((result, index) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => choose(result)}
                  className={`flex min-h-[44px] w-full cursor-pointer flex-col gap-[3px] px-0.5 py-3.5 text-left transition-colors hover:bg-surface-subtle ${
                    index === results.length - 1 ? '' : 'border-b border-hairline'
                  }`}
                >
                  <span className="text-[17px] leading-[1.2] text-ink">
                    {result.label.split(',')[0]}
                  </span>
                  <span className="text-[17px] leading-none text-ink-muted">
                    {result.label.split(',').slice(1).join(',').trim()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {extrasOpen ? (
          <div className="mt-[22px] flex flex-col gap-2.5 border-t border-hairline pt-[18px]">
            <label className="text-[17px] leading-none text-ink" htmlFor="access-notes">
              Flat number, buzzer, parking
            </label>
            <textarea
              id="access-notes"
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              rows={3}
              className="min-h-[76px] w-full rounded-[10px] bg-field p-3.5 text-[17px] leading-[1.35] text-ink focus:shadow-[0_0_0_4px_rgb(168_72_31/0.16)] focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExtrasOpen(true)}
            className="mt-[22px] flex min-h-[44px] w-full cursor-pointer items-center justify-between border-t border-hairline py-3.5 text-[17px] leading-none text-ink"
          >
            <span>Flat number, buzzer, parking</span>
            <span className="text-ink-muted">Optional +</span>
          </button>
        )}
      </div>

      <ActionBar>
        <PrimaryButton
          disabled={!selected || checking}
          onClick={() =>
            selected &&
            onContinue({
              line1: selected.label.split(',')[0],
              postcode: selected.postcode,
              lat: selected.lat,
              lng: selected.lng,
              accessNotes: accessNotes.trim() || null,
            })
          }
        >
          {checking ? 'Checking…' : 'Continue'}
        </PrimaryButton>
      </ActionBar>
    </>
  )
}

/**
 * Artboard 1c — out of area. Information, not an error: no red, no warning
 * icon. The request is logged server-side as unmet demand.
 */
function OutOfAreaScreen({
  businessName,
  address,
  postcodeArea,
  onChooseDifferent,
}: {
  businessName: string
  address: string
  postcodeArea: string[]
  onChooseDifferent: () => void
}) {
  const covers =
    postcodeArea.length > 1
      ? `${postcodeArea.slice(0, -1).join(', ')} and ${postcodeArea.at(-1)}`
      : postcodeArea[0]

  return (
    <>
      <div className="px-5 pt-[26px]">
        <div className="rounded-[10px] bg-field px-3.5 py-3 text-[17px] leading-[1.2] text-ink-secondary">
          {address}
        </div>
        <div className="mt-6 rounded-[14px] bg-accent-tint px-5 py-[22px]">
          <h2 className="font-display m-0 text-[22px] leading-[1.3] font-semibold tracking-[-0.01em] text-ink">
            {businessName} doesn&rsquo;t travel to that area yet.
          </h2>
          {covers ? (
            <p className="mt-3 mb-0 text-[17px] leading-[1.5] text-ink-secondary text-pretty">
              They currently cover {covers}.
            </p>
          ) : null}
        </div>
        <p className="mt-[22px] mb-0 px-0.5 text-[17px] leading-[1.5] text-ink-muted text-pretty">
          We&rsquo;ve let {businessName} know someone asked for this area. That helps them
          decide where to travel next.
        </p>
      </div>

      <ActionBar>
        {/*
          The artboard's primary action here is "Let them know you're interested".
          In this implementation the service-area check ALREADY logs the request
          as unmet demand, so that button would submit nothing — and a waitlist
          is explicitly deferred. The copy above states it in the past tense and
          the one primary action is the step that actually moves the customer on.
        */}
        <PrimaryButton onClick={onChooseDifferent}>Choose a different address</PrimaryButton>
      </ActionBar>
    </>
  )
}
