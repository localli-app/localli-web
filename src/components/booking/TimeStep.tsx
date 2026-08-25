'use client'

import { useCallback, useEffect, useState } from 'react'
import { dayStripLabels, formatTime, localDateOf, relativeDayLabel } from '@/lib/format'
import { ActionBar, PrimaryButton, ScreenTitle } from './primitives'

export interface SlotView {
  startsAt: string
  endsAt: string
  staffId: string
  staffName: string
  travelInMinutes?: number
  travelOutMinutes?: number
}

interface DaySlotsView {
  date: string
  slots: SlotView[]
}

/**
 * Artboards 1d and 1e — time selection.
 *
 * Next-three-available comes BEFORE any calendar: three named times are a
 * choice, a calendar grid is a decision surface. The grid is the fallback.
 */
export function TimeStep({
  businessSlug,
  serviceId,
  timezone,
  isMobile,
  destination,
  priceLabel,
  onChoose,
}: {
  businessSlug: string
  serviceId: string
  timezone: string
  isMobile: boolean
  destination: { lat: number; lng: number } | null
  priceLabel: string
  onChoose: (slot: SlotView) => void
}) {
  const [nextSlots, setNextSlots] = useState<SlotView[] | null>(null)
  const [selected, setSelected] = useState<SlotView | null>(null)
  const [gridOpen, setGridOpen] = useState(false)
  const [days, setDays] = useState<DaySlotsView[]>([])
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  const geoQuery = useCallback(() => {
    if (!isMobile || !destination) return ''
    return `&lat=${destination.lat}&lng=${destination.lng}`
  }, [isMobile, destination])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch(
          `/api/public/businesses/${businessSlug}/next-available?serviceId=${serviceId}${geoQuery()}`,
        )
        const payload = (await response.json()) as { data?: { slots: SlotView[] } }
        if (!cancelled) {
          if (payload.data) setNextSlots(payload.data.slots)
          else setLoadError(true)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [businessSlug, serviceId, geoQuery])

  async function openGrid() {
    setGridOpen(true)
    const from = localDateOf(new Date(), timezone)
    const to = localDateOf(new Date(Date.now() + 13 * 86_400_000), timezone)
    try {
      const response = await fetch(
        `/api/public/businesses/${businessSlug}/availability?serviceId=${serviceId}&from=${from}&to=${to}${geoQuery()}`,
      )
      const payload = (await response.json()) as { data?: { days: DaySlotsView[] } }
      if (payload.data) {
        setDays(payload.data.days)
        const firstWithSlots = payload.data.days.find((d) => d.slots.length > 0)
        setActiveDate(firstWithSlots?.date ?? payload.data.days[0]?.date ?? null)
      }
    } catch {
      setLoadError(true)
    }
  }

  const now = new Date()
  const activeDay = days.find((d) => d.date === activeDate)

  // Artboard 1e — nothing bookable in the window we scanned.
  if (nextSlots !== null && nextSlots.length === 0 && !gridOpen) {
    return (
      <>
        <div className="px-5 pt-[26px]">
          <div className="rounded-[14px] bg-field px-5 py-[26px]">
            <h2 className="font-display m-0 text-[22px] leading-[1.35] font-semibold text-ink">
              No times available just now.
            </h2>
            <p className="mt-2.5 mb-0 text-[17px] leading-[1.5] text-ink-secondary">
              Everything is booked up for the next few weeks.
            </p>
          </div>
        </div>
        <ActionBar>
          <PrimaryButton onClick={openGrid}>See the full calendar</PrimaryButton>
        </ActionBar>
      </>
    )
  }

  return (
    <>
      <div className="px-5 pt-[26px]">
        <ScreenTitle>Next available</ScreenTitle>

        <div className="mt-[18px] flex gap-2.5">
          {nextSlots === null
            ? [0, 1, 2].map((i) => (
                <div
                  key={i}
                  aria-hidden
                  className="min-h-[96px] flex-1 animate-pulse rounded-[14px] bg-field"
                />
              ))
            : nextSlots.map((slot) => {
                const isSelected = selected?.startsAt === slot.startsAt
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setSelected(slot)}
                    aria-pressed={isSelected}
                    className={`flex min-h-[96px] flex-1 cursor-pointer flex-col items-center justify-center gap-[7px] rounded-[14px] border border-[rgb(32_28_24/0.16)] bg-surface transition-colors hover:bg-surface-subtle ${
                      isSelected ? 'shadow-[inset_0_0_0_2px_var(--ll-accent)]' : ''
                    }`}
                  >
                    <span className="text-[17px] leading-none text-ink-muted">
                      {relativeDayLabel(new Date(slot.startsAt), timezone, now)}
                    </span>
                    <span className="font-display text-[20px] leading-none font-semibold text-ink">
                      {formatTime(new Date(slot.startsAt), timezone)}
                    </span>
                  </button>
                )
              })}
        </div>

        {/* The provider-facing travel note, shown only for mobile businesses. */}
        {isMobile && selected?.travelInMinutes !== undefined ? (
          <div className="mt-3.5 text-[17px] leading-[1.4] text-ink-muted">
            {selected.travelInMinutes} min drive from the previous booking
          </div>
        ) : null}

        {loadError ? (
          <p className="mt-3.5 text-[17px] leading-[1.4] text-ink-muted">
            We couldn&rsquo;t load times just now. Please try again.
          </p>
        ) : null}

        {gridOpen ? (
          <div className="mt-[26px] border-t border-hairline pt-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((day) => {
                const { dow, num } = dayStripLabels(day.date, timezone)
                const isActive = day.date === activeDate
                const isEmpty = day.slots.length === 0
                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={isEmpty}
                    onClick={() => setActiveDate(day.date)}
                    className={`flex w-14 flex-none flex-col items-center gap-1 rounded-[12px] bg-field py-[11px] ${
                      isActive ? 'shadow-[inset_0_0_0_2px_var(--ll-accent)]' : ''
                    } ${isEmpty ? 'opacity-40' : 'cursor-pointer'}`}
                  >
                    <span className="text-[13px] leading-none text-ink-muted">{dow}</span>
                    <span className="text-[17px] leading-none font-semibold text-ink">{num}</span>
                  </button>
                )
              })}
            </div>

            {activeDay && activeDay.slots.length > 0 ? (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {activeDay.slots.map((slot) => {
                  const isSelected = selected?.startsAt === slot.startsAt
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => setSelected(slot)}
                      aria-pressed={isSelected}
                      className={`min-h-[46px] cursor-pointer rounded-[11px] border border-[rgb(32_28_24/0.14)] bg-surface text-[17px] leading-none text-ink transition-colors hover:bg-surface-subtle ${
                        isSelected ? 'shadow-[inset_0_0_0_2px_var(--ll-accent)]' : ''
                      }`}
                    >
                      {formatTime(new Date(slot.startsAt), timezone)}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="mt-4 text-[17px] leading-[1.4] text-ink-muted">
                Nothing free on that day.
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openGrid}
            className="mt-3.5 flex min-h-[44px] w-full cursor-pointer items-center py-4 text-left text-[17px] leading-none text-accent"
          >
            See other times
          </button>
        )}
      </div>

      <ActionBar>
        <PrimaryButton disabled={!selected} onClick={() => selected && onChoose(selected)}>
          Continue
          <span className="font-normal opacity-85">&nbsp;· {priceLabel}</span>
        </PrimaryButton>
      </ActionBar>
    </>
  )
}
