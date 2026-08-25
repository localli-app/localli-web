'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { WizardActions } from '../wizard'

type Mode = 'premises' | 'mobile' | 'both'

const OPTIONS: { key: Mode; label: string; detail: string }[] = [
  {
    key: 'premises',
    label: 'Clients come to me',
    detail: 'A salon, studio, or a room you work from.',
  },
  {
    key: 'mobile',
    label: 'I travel to clients',
    detail: 'We check you can physically get between jobs before offering a time.',
  },
  {
    key: 'both',
    label: 'Both',
    detail: 'Some clients come to you, some you travel to.',
  },
]

/**
 * Step 2, asked early on purpose: mobile-versus-premises changes the next
 * steps and a good deal of the dashboard. Getting it wrong later is a settings
 * change plus confusion.
 */
export function WhereStep({ initialIsMobile }: { initialIsMobile: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialIsMobile ? 'mobile' : 'premises')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const response = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // "Both" still needs the travel machinery, so it enables the module.
        body: JSON.stringify({ isMobileEnabled: mode !== 'premises' }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload?.error?.message ?? 'That did not save.')
        return
      }
      router.push('/app/setup/address')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-[26px] flex flex-col gap-2.5">
        {OPTIONS.map((option) => {
          const selected = mode === option.key
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(option.key)}
              className={`flex items-start gap-3.5 rounded-[14px] border p-[18px] text-left transition-colors ${
                selected ? 'border-accent bg-accent-tint' : 'border-hairline bg-surface hover:bg-surface-subtle'
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.5px] ${
                  selected ? 'border-accent' : 'border-ink/30'
                }`}
              >
                {selected && <span className="h-3 w-3 rounded-full bg-accent" />}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[16px] leading-[1.2] font-semibold text-ink">
                  {option.label}
                </span>
                <span className="text-[14px] leading-[1.45] text-ink-secondary">
                  {option.detail}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="mt-3 text-[14px] text-status-noshow">{error}</p>}

      <WizardActions skipHref="/app/setup/address">
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
