'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Export and deletion.
 *
 * Deletion asks them to type the slug rather than clicking a confirm button:
 * it is the only irreversible action in the product, and a dialog you can
 * dismiss by reflex is not a confirmation.
 */
export function DangerZone({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsReauth, setNeedsReauth] = useState(false)

  async function remove() {
    setError(null)
    setNeedsReauth(false)
    setBusy(true)
    try {
      const response = await fetch('/api/business/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmSlug: confirm.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload?.error?.message ?? 'That did not work.')
        setNeedsReauth(Boolean(payload?.error?.details?.needsReauth))
        return
      }
      // The business no longer exists and the cookie has been cleared, so the
      // cached dashboard payload must not be reused.
      router.replace('/app/signin')
      router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6 rounded-[14px] border border-hairline p-5">
      <h2 className="mb-1 text-[15px] leading-none font-semibold text-ink">Your data</h2>

      {/* eslint-disable @next/next/no-html-link-for-pages -- these are API
          routes that stream a download, not pages; Link would try to
          client-navigate them and the file would never arrive. */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <a
          href="/api/business/export"
          className="flex h-11 items-center justify-center rounded-[10px] border border-ink/15 px-4 text-[14px] font-semibold text-ink transition-colors hover:bg-field"
        >
          Export everything (JSON)
        </a>
        <a
          href="/api/business/export?format=csv"
          className="flex h-11 items-center justify-center rounded-[10px] border border-ink/15 px-4 text-[14px] font-semibold text-ink transition-colors hover:bg-field"
        >
          Export customers (CSV)
        </a>
      </div>
      {/* eslint-enable @next/next/no-html-link-for-pages */}
      <p className="mt-3 text-[13px] leading-[1.5] text-ink-muted">
        Everything you hold about your own customers, yours to take. Where someone also books at
        another Localli business is not included — that was never your data.
      </p>

      {isOwner && (
        <div className="mt-6 border-t border-hairline pt-5">
          <h3 className="text-[15px] leading-none font-semibold text-ink">Delete this business</h3>
          <p className="mt-2 text-[13px] leading-[1.5] text-ink-secondary">
            Permanently removes your booking page, services, staff and booking history. Customers
            keep their own records of appointments they booked elsewhere. This cannot be undone.
          </p>

          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 flex h-11 items-center rounded-[10px] border border-status-noshow/40 px-4 text-[14px] font-semibold text-status-noshow transition-colors hover:bg-status-noshow/5"
            >
              Delete business
            </button>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[14px] text-ink-secondary">
                  Type <span className="font-mono font-semibold text-ink">{slug}</span> to confirm
                </span>
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                  className="h-11 max-w-[320px] rounded-[10px] bg-field px-3.5 font-mono text-[15px] text-ink outline-none"
                />
              </label>

              {error && (
                <p className="text-[14px] text-status-noshow">
                  {error}
                  {needsReauth && (
                    <>
                      {' '}
                      <Link href="/app/signin" className="underline underline-offset-2">
                        Sign in again
                      </Link>
                    </>
                  )}
                </p>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy || confirm.trim() !== slug}
                  className="flex h-11 items-center rounded-[10px] bg-status-noshow px-4 text-[14px] font-semibold text-white disabled:opacity-40"
                >
                  {busy ? 'Deleting…' : 'Permanently delete'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setConfirm('')
                    setError(null)
                  }}
                  className="flex h-11 items-center rounded-[10px] border border-ink/15 px-4 text-[14px] text-ink transition-colors hover:bg-field"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
