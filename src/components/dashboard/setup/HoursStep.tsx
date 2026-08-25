'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { WizardActions } from '../wizard'

const DAYS = [
  { weekday: 1, label: 'Monday' },
  { weekday: 2, label: 'Tuesday' },
  { weekday: 3, label: 'Wednesday' },
  { weekday: 4, label: 'Thursday' },
  { weekday: 5, label: 'Friday' },
  { weekday: 6, label: 'Saturday' },
  { weekday: 0, label: 'Sunday' },
]

interface DayState {
  open: boolean
  opensLocal: string
  closesLocal: string
}

/**
 * Step 4. Pre-filled, so this is a screen of confirmations rather than a form.
 * Tap a day to close it; tap the times to change them.
 */
export function HoursStep({
  initialHours,
}: {
  initialHours: { weekday: number; opensLocal: string; closesLocal: string }[]
}) {
  const router = useRouter()

  const [days, setDays] = useState<Record<number, DayState>>(() => {
    const seeded: Record<number, DayState> = {}
    for (const day of DAYS) {
      const existing = initialHours.find((h) => h.weekday === day.weekday)
      seeded[day.weekday] = existing
        ? { open: true, opensLocal: existing.opensLocal, closesLocal: existing.closesLocal }
        : { open: false, opensLocal: '09:00', closesLocal: '18:00' }
    }
    return seeded
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(weekday: number) {
    setDays((prev) => ({ ...prev, [weekday]: { ...prev[weekday], open: !prev[weekday].open } }))
  }

  function setTime(weekday: number, field: 'opensLocal' | 'closesLocal', value: string) {
    setDays((prev) => ({ ...prev, [weekday]: { ...prev[weekday], [field]: value } }))
  }

  async function save() {
    setError(null)
    const hours = DAYS.filter((d) => days[d.weekday].open).map((d) => ({
      weekday: d.weekday,
      opensLocal: days[d.weekday].opensLocal,
      closesLocal: days[d.weekday].closesLocal,
    }))

    if (hours.some((h) => h.opensLocal === h.closesLocal)) {
      setError('A day cannot open and close at the same time.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/business/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload?.error?.message ?? 'That did not save.')
        return
      }
      router.push('/app/setup/services')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  const openCount = DAYS.filter((d) => days[d.weekday].open).length

  return (
    <>
      <div className="mt-[26px] rounded-[14px] border border-hairline bg-surface px-[22px] py-2">
        {DAYS.map((day) => {
          const state = days[day.weekday]
          return (
            <div
              key={day.weekday}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-soft py-3 last:border-b-0"
            >
              <button
                type="button"
                role="switch"
                aria-checked={state.open}
                onClick={() => toggle(day.weekday)}
                className="flex min-h-[44px] flex-1 items-center gap-3.5 text-left"
              >
                <span
                  aria-hidden
                  className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] ${
                    state.open ? 'border-accent bg-accent' : 'border-ink/30 bg-surface'
                  }`}
                >
                  {state.open && (
                    <span className="-mt-0.5 h-[5px] w-[9px] -rotate-45 border-b-2 border-l-2 border-white" />
                  )}
                </span>
                <span
                  className={`text-[15px] font-semibold ${state.open ? 'text-ink' : 'text-ink-muted'}`}
                >
                  {day.label}
                </span>
              </button>

              {state.open ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={state.opensLocal}
                    onChange={(e) => setTime(day.weekday, 'opensLocal', e.target.value)}
                    aria-label={`${day.label} opens`}
                    className="h-10 rounded-[9px] border border-ink/15 bg-surface px-2.5 text-[15px] text-ink outline-none"
                  />
                  <span className="text-ink-muted">to</span>
                  <input
                    type="time"
                    value={state.closesLocal}
                    onChange={(e) => setTime(day.weekday, 'closesLocal', e.target.value)}
                    aria-label={`${day.label} closes`}
                    className="h-10 rounded-[9px] border border-ink/15 bg-surface px-2.5 text-[15px] text-ink outline-none"
                  />
                </div>
              ) : (
                <span className="text-[14px] text-ink-muted">Closed</span>
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 text-[14px] text-status-noshow">{error}</p>}

      <WizardActions
        skipHref="/app/setup/services"
        note={
          <span className="text-[14px] leading-none text-ink-muted">
            {openCount} day{openCount === 1 ? '' : 's'} open
          </span>
        }
      >
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-[46px] items-center rounded-[11px] bg-accent px-[26px] text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </WizardActions>
    </>
  )
}
