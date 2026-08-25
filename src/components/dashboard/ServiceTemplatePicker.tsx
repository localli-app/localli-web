'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { TemplateCategory } from '@/lib/dashboard/service-templates'

interface Picked {
  checked: boolean
  price: string
}

/**
 * Onboarding step 5. Ticking boxes, with the price as the only thing anyone has
 * to type — that is what makes this step finish rather than stall.
 */
export function ServiceTemplatePicker({
  categories,
  currencySymbol = '£',
}: {
  categories: TemplateCategory[]
  currencySymbol?: string
}) {
  const router = useRouter()
  const [state, setState] = useState<Record<string, Picked>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCount = useMemo(
    () => Object.values(state).filter((v) => v.checked).length,
    [state],
  )

  function toggle(key: string, suggested?: number) {
    setState((prev) => {
      const current = prev[key]
      const nextChecked = !current?.checked
      return {
        ...prev,
        [key]: {
          checked: nextChecked,
          // Prefill from the suggestion on first tick so the field is a
          // confirmation rather than a blank.
          price:
            current?.price ??
            (suggested != null ? String(Math.round(suggested / 100)) : ''),
        },
      }
    })
  }

  function setPrice(key: string, price: string) {
    setState((prev) => ({ ...prev, [key]: { checked: true, price } }))
  }

  async function submit() {
    setError(null)
    const services = Object.entries(state)
      .filter(([, v]) => v.checked)
      .map(([key, v]) => ({ templateKey: key, priceMinor: Math.round(Number(v.price || 0) * 100) }))

    if (services.some((s) => !Number.isFinite(s.priceMinor) || s.priceMinor <= 0)) {
      setError('Give every service you ticked a price.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/business/services/from-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload?.error?.message ?? 'That did not save.')
        return
      }
      router.push('/app/services')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-[26px] rounded-[14px] border border-hairline bg-surface px-[22px] pt-2 pb-[22px]">
        {categories.map((category) => (
          <div key={category.key}>
            <h3 className="pt-[18px] pb-1.5 text-[13px] leading-none font-semibold tracking-[0.07em] text-ink-muted uppercase">
              {category.label}
            </h3>
            {category.services.map((service) => {
              const entry = state[service.key]
              const checked = Boolean(entry?.checked)
              return (
                <div
                  key={service.key}
                  className="flex min-h-[56px] flex-wrap items-center gap-4 border-b border-hairline-soft last:border-b-0"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(service.key, service.suggestedPriceMinor)}
                    className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3.5 text-left"
                  >
                    <span
                      aria-hidden
                      className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] ${
                        checked ? 'border-accent bg-accent' : 'border-ink/30 bg-surface'
                      }`}
                    >
                      {checked && (
                        <span className="-mt-0.5 h-[5px] w-[9px] -rotate-45 border-b-2 border-l-2 border-white" />
                      )}
                    </span>
                    <span className="truncate text-[15px] leading-[1.2] font-semibold text-ink">
                      {service.name}
                    </span>
                    <span className="flex-none text-[14px] leading-none text-ink-muted">
                      {service.durationMinutes} min
                    </span>
                  </button>

                  <div className="flex flex-none items-center gap-2">
                    <span className="text-[15px] leading-none text-ink-secondary">
                      {currencySymbol}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={entry?.price ?? ''}
                      onChange={(e) => setPrice(service.key, e.target.value.replace(/[^\d.]/g, ''))}
                      onFocus={() => {
                        if (!checked) toggle(service.key, service.suggestedPriceMinor)
                      }}
                      aria-label={`Price for ${service.name}`}
                      className={`h-10 w-[104px] rounded-[9px] border px-3 text-[15px] font-semibold text-ink outline-none ${
                        checked ? 'border-ink/20 bg-surface' : 'border-hairline bg-[#F5F1EB]'
                      }`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        <div className="mt-[18px]">
          <Link
            href="/app/services"
            className="inline-flex min-h-[44px] items-center rounded-[10px] border border-dashed border-ink/30 px-4 text-[14px] leading-none font-semibold text-ink transition-colors hover:bg-surface-subtle"
          >
            + Add your own
          </Link>
        </div>
      </div>

      {error && <p className="mt-3 text-[14px] text-status-noshow">{error}</p>}

      <div className="mt-[22px] flex flex-wrap items-center justify-between gap-5">
        {/* Every step after the first is skippable. A half-configured business
            that took one booking is worth more than a complete one that never
            started. */}
        <Link
          href="/app"
          className="text-[14px] leading-none text-ink-muted underline-offset-2 hover:underline"
        >
          Skip for now
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[14px] leading-none text-ink-muted">{selectedCount} selected</span>
          <button
            type="button"
            onClick={submit}
            disabled={saving || selectedCount === 0}
            className="flex h-[46px] items-center rounded-[11px] bg-accent px-[26px] text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    </>
  )
}
