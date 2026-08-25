'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { WizardActions } from '../wizard'

interface Member {
  name: string
  email: string
}

/**
 * Step 6. Most first users are solo, so "Just me" is the primary path and
 * finishes the wizard immediately. A one-person business should never feel
 * like it is using software built for a chain.
 */
export function TeamStep({ ownerName }: { ownerName: string }) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function add() {
    setMembers((prev) => [...prev, { name: '', email: '' }])
  }

  function update(index: number, field: keyof Member, value: string) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)))
  }

  function remove(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index))
  }

  async function finish() {
    setError(null)
    const named = members.filter((m) => m.name.trim())

    setSaving(true)
    try {
      if (named.length > 0) {
        const response = await fetch('/api/business/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff: named.map((m) => ({
              name: m.name.trim(),
              email: m.email.trim() || null,
              isBookable: true,
            })),
          }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          setError(payload?.error?.message ?? 'That did not save.')
          return
        }
      }

      await fetch('/api/business/onboarding/complete', { method: 'POST' })
      router.push('/app/setup/done')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  const field =
    'h-11 w-full rounded-[10px] bg-field px-3.5 text-[15px] text-ink outline-none placeholder:text-ink-faint'

  return (
    <>
      <div className="mt-[26px] rounded-[14px] border border-hairline bg-surface p-[22px]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-field text-[15px] font-semibold text-ink">
            {ownerName.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[15px] leading-none font-semibold text-ink">{ownerName}</span>
            <span className="text-[13px] leading-none text-ink-muted">Owner · that&rsquo;s you</span>
          </span>
        </div>

        {members.length > 0 && (
          <div className="mt-5 flex flex-col gap-4 border-t border-hairline pt-5">
            {members.map((member, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-[160px] flex-1 flex-col gap-2">
                  <span className="text-[13px] text-ink-secondary">Name</span>
                  <input
                    value={member.name}
                    onChange={(e) => update(index, 'name', e.target.value)}
                    placeholder="Nia"
                    className={field}
                  />
                </label>
                <label className="flex min-w-[180px] flex-1 flex-col gap-2">
                  <span className="text-[13px] text-ink-secondary">Email (optional)</span>
                  <input
                    type="email"
                    value={member.email}
                    onChange={(e) => update(index, 'email', e.target.value)}
                    placeholder="nia@example.com"
                    className={field}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="flex h-11 min-w-[44px] items-center justify-center rounded-[10px] border border-ink/15 px-3 text-[14px] text-ink-muted transition-colors hover:bg-field"
                  aria-label={`Remove ${member.name || 'this person'}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={add}
            className="inline-flex min-h-[44px] items-center rounded-[10px] border border-dashed border-ink/30 px-4 text-[14px] leading-none font-semibold text-ink transition-colors hover:bg-surface-subtle"
          >
            + Add someone
          </button>
        </div>

        <p className="mt-4 text-[13px] leading-[1.5] text-ink-muted">
          Anyone you add inherits your opening hours and every service, and can be adjusted later.
        </p>
      </div>

      {error && <p className="mt-3 text-[14px] text-status-noshow">{error}</p>}

      <WizardActions skipHref="/app/setup/done">
        <button
          type="button"
          onClick={finish}
          disabled={saving}
          className="flex h-[46px] items-center rounded-[11px] bg-accent px-[26px] text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? 'Finishing…' : members.length > 0 ? 'Add and finish' : 'Just me — finish'}
        </button>
      </WizardActions>
    </>
  )
}
