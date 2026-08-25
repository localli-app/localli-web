'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { WizardActions } from '../wizard'

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/**
 * Step 1. Showing the booking link appear as they type their name is the
 * moment the product becomes real to them, so the link is the loudest thing
 * on this screen — not the input.
 */
export function BusinessNameStep({
  initialName,
  initialSlug,
  linkOrigin,
}: {
  initialName: string
  initialSlug: string
  linkOrigin: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [slugEdited, setSlugEdited] = useState(false)
  const [editingSlug, setEditingSlug] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveSlug = slugEdited ? slug : slugify(name) || initialSlug

  async function save() {
    setError(null)
    if (!name.trim()) {
      setError('What are you called?')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: effectiveSlug }),
      })
      const payload = await response.json()
      if (!response.ok) {
        const suggestion = payload?.error?.details?.suggestion
        setError(
          suggestion
            ? `${payload.error.message} How about ${suggestion}?`
            : (payload?.error?.message ?? 'That did not save.'),
        )
        if (suggestion) {
          setSlug(suggestion)
          setSlugEdited(true)
          setEditingSlug(true)
        }
        return
      }
      router.push('/app/setup/where')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-[26px] rounded-[14px] border border-hairline bg-surface p-[22px]">
        <label className="flex flex-col gap-2">
          <span className="text-[14px] text-ink-secondary">Business name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={120}
            placeholder="Glow Studio"
            className="h-12 rounded-[10px] bg-field px-3.5 text-[17px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-faint"
          />
        </label>

        <div className="mt-6 border-t border-hairline pt-5">
          <p className="text-[14px] text-ink-secondary">Your booking link will be</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[17px] leading-[1.3] font-semibold break-all text-ink md:text-[20px]">
              {linkOrigin}/
              {editingSlug ? (
                <input
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugEdited(true)
                    setSlug(slugify(e.target.value))
                  }}
                  aria-label="Your booking link"
                  className="w-[220px] rounded-[8px] bg-field px-2 py-1 font-mono text-[17px] font-semibold text-accent outline-none md:text-[20px]"
                />
              ) : (
                <span className="text-accent">{effectiveSlug || '…'}</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setEditingSlug((v) => !v)}
              className="flex min-h-[36px] items-center rounded-lg border border-ink/15 px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-field"
            >
              {editingSlug ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-[14px] text-status-noshow">{error}</p>}

      <WizardActions skipHref="/app/setup/where">
        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim()}
          className="flex h-[46px] items-center rounded-[11px] bg-accent px-[26px] text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </WizardActions>
    </>
  )
}
