'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export interface SessionRow {
  id: string
  issuedAt: string
  lastSeenAt: string
  ip: string | null
  userAgent: string | null
  isCurrent: boolean
}

/** Turns a user-agent string into something an owner would recognise. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'

  const os = /iPhone/i.test(userAgent)
    ? 'iPhone'
    : /iPad/i.test(userAgent)
      ? 'iPad'
      : /Android/i.test(userAgent)
        ? 'Android'
        : /Mac OS X|Macintosh/i.test(userAgent)
          ? 'Mac'
          : /Windows/i.test(userAgent)
            ? 'Windows'
            : /Linux/i.test(userAgent)
              ? 'Linux'
              : 'Unknown device'

  // Order matters: Chrome and Edge both claim Safari, Edge also claims Chrome.
  const browser = /Edg\//i.test(userAgent)
    ? 'Edge'
    : /OPR\//i.test(userAgent)
      ? 'Opera'
      : /Chrome\//i.test(userAgent)
        ? 'Chrome'
        : /Firefox\//i.test(userAgent)
          ? 'Firefox'
          : /Safari\//i.test(userAgent)
            ? 'Safari'
            : null

  return browser ? `${os} · ${browser}` : os
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * Where an owner sees which devices are signed in and can cut one off.
 *
 * The case this exists for is mundane and real: a salon laptop everyone uses,
 * or a phone left at a job.
 */
export function SessionList({ initial }: { initial: SessionRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function revoke(sessionId?: string) {
    setError(null)
    setBusy(sessionId ?? 'all')
    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionId ? { sessionId } : {}),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload?.error?.message ?? 'That did not work.')
        return
      }
      // Revoking the current session logs this device out, so the cached
      // dashboard payload must be discarded rather than reused.
      if (sessionId && initial.find((s) => s.id === sessionId)?.isCurrent) {
        router.replace('/app/signin')
        router.refresh()
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(null)
    }
  }

  const others = initial.filter((s) => !s.isCurrent)

  return (
    <div className="max-w-[760px]">
      <div className="flex flex-col rounded-[14px] border border-hairline">
        {initial.map((session) => (
          <div
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-soft p-4 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2.5 text-[15px] leading-none font-semibold text-ink">
                {describeDevice(session.userAgent)}
                {session.isCurrent && (
                  <span className="rounded-md bg-accent-tint px-2 py-0.5 text-[12px] leading-none font-semibold text-accent-hover">
                    This device
                  </span>
                )}
              </span>
              <span className="text-[13px] leading-none text-ink-muted">
                Active {relativeTime(session.lastSeenAt)}
                {session.ip && <> · {session.ip}</>}
              </span>
            </div>
            <button
              type="button"
              onClick={() => revoke(session.id)}
              disabled={busy !== null || pending}
              className="flex h-9 flex-none items-center rounded-lg border border-ink/15 px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-field disabled:opacity-40"
            >
              {busy === session.id ? 'Signing out…' : session.isCurrent ? 'Sign out' : 'Sign out'}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-[14px] text-status-noshow">{error}</p>}

      {others.length > 0 && (
        <button
          type="button"
          onClick={() => revoke()}
          disabled={busy !== null || pending}
          className="mt-4 flex h-11 items-center rounded-[10px] border border-border-strong px-4 text-[15px] font-semibold text-ink transition-colors hover:bg-surface-subtle disabled:opacity-40"
        >
          {busy === 'all'
            ? 'Signing out…'
            : `Sign out ${others.length} other device${others.length === 1 ? '' : 's'}`}
        </button>
      )}

      <p className="mt-4 text-[13px] leading-[1.5] text-ink-muted">
        Signing out a device does not affect your booking page — customers can still book while you
        are signed out.
      </p>
    </div>
  )
}
