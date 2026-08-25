'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { durationBarHeight, presentStatus } from '@/lib/dashboard/status'

export interface AgendaRowData {
  id: string
  startLabel: string
  endLabel: string
  durationMinutes: number
  status: string
  serviceName: string
  priceLabel: string
  customerName: string
  customerPhone: string | null
  staffName: string
  address: string | null
  spanLabel: string
  sourceLabel: string
}

/**
 * One booking on the agenda.
 *
 * Actions are inline on desktop and a bottom sheet on phone — the same set
 * either way, because nothing a laptop can do may be missing on a phone.
 */
export function AgendaRow({ data }: { data: AgendaRowData }) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const status = presentStatus(data.status)
  const barHeight = durationBarHeight(data.durationMinutes)
  const isTerminal = ['completed', 'no_show', 'cancelled_by_customer', 'cancelled_by_business'].includes(
    data.status,
  )

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  async function setStatus(next: 'completed' | 'no_show') {
    setError(null)
    try {
      const response = await fetch(`/api/business/bookings/${data.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload?.error?.message ?? 'That did not work.')
        return
      }
      setSheetOpen(false)
      startTransition(() => router.refresh())
    } catch {
      setError('Could not reach the server.')
    }
  }

  const actions = (
    <>
      {data.customerPhone && (
        <a
          href={`tel:${data.customerPhone.replace(/\s/g, '')}`}
          className="flex h-[30px] items-center rounded-lg border border-ink/15 bg-surface px-[11px] text-[13px] leading-none text-ink transition-colors hover:bg-field"
        >
          Call
        </a>
      )}
      {!isTerminal && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus('completed')}
            className="flex h-[30px] items-center rounded-lg border border-ink/15 bg-surface px-[11px] text-[13px] leading-none text-ink transition-colors hover:bg-field disabled:opacity-50"
          >
            Complete
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus('no_show')}
            className="flex h-[30px] items-center rounded-lg border border-ink/15 bg-surface px-[11px] text-[13px] leading-none text-ink transition-colors hover:bg-field disabled:opacity-50"
          >
            No-show
          </button>
        </>
      )}
      <a
        href={`/app/bookings?focus=${data.id}`}
        className="flex h-[30px] items-center rounded-lg border border-ink/15 bg-surface px-[11px] text-[13px] leading-none text-ink transition-colors hover:bg-field"
      >
        Details
      </a>
    </>
  )

  return (
    <>
      <div className="group relative flex gap-3 rounded-xl border border-hairline bg-surface p-3 transition-colors hover:bg-surface-subtle md:gap-4">
        <div className="flex w-12 flex-none flex-col justify-between py-0.5 font-mono text-[13px] leading-none text-ink-muted md:w-14">
          <span>{data.startLabel}</span>
          <span>{data.endLabel}</span>
        </div>

        <div
          className={`w-1 flex-none rounded-sm ${status.dot}`}
          style={{ minHeight: `${barHeight}px` }}
          aria-hidden
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-5">
          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="flex items-baseline justify-between gap-3 md:justify-start">
              <span className="text-[15px] leading-[1.2] font-semibold text-ink">
                {data.serviceName}
              </span>
              <span className="text-[14px] leading-none font-semibold text-ink">
                {data.priceLabel}
              </span>
            </div>
            <span className="text-[14px] leading-[1.4] text-ink-secondary">
              {data.customerName}
              {data.customerPhone && (
                <span className="hidden md:inline"> · {data.customerPhone}</span>
              )}{' '}
              · with {data.staffName}
            </span>
            {data.address && (
              <span className="text-[13px] leading-[1.4] text-ink-muted">{data.address}</span>
            )}
          </div>

          <div className="flex flex-col items-start gap-2.5 md:items-end">
            <span className={`inline-flex items-center gap-1.5 text-[13px] leading-none ${status.text}`}>
              <span className={`h-[7px] w-[7px] rounded-full ${status.dot}`} aria-hidden />
              {status.label}
            </span>
            {/* Inline actions are desktop-only; on phone the row opens a sheet. */}
            <div className="hidden gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
              {actions}
            </div>
          </div>
        </div>

        {/* Phone-only tap target. Covers the row without nesting buttons. */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="absolute inset-0 md:hidden"
        >
          <span className="sr-only">
            {data.serviceName} for {data.customerName}, {data.spanLabel}. Open actions.
          </span>
        </button>
      </div>

      {error && <p className="px-3 text-[13px] text-status-noshow">{error}</p>}

      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-ink/35 md:hidden"
          onClick={() => setSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-label={`${data.serviceName} for ${data.customerName}`}
            className="w-full rounded-t-[20px] bg-surface px-[18px] pt-2.5 pb-[max(1.375rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-[38px] rounded-sm bg-ink/20" aria-hidden />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] leading-[1.25] font-semibold text-ink">
                {data.serviceName}
              </span>
              <span className="text-[15px] leading-none font-semibold text-ink">
                {data.priceLabel}
              </span>
            </div>
            <p className="mt-1 text-[14px] leading-[1.45] text-ink-secondary">
              {data.customerName} · {data.spanLabel} · with {data.staffName}
            </p>
            {data.address && (
              <p className="pb-2 text-[13px] leading-[1.45] text-ink-muted">
                {data.address} · booked via {data.sourceLabel}
              </p>
            )}

            <div className="flex flex-col border-t border-hairline">
              {data.customerPhone && (
                <a
                  href={`tel:${data.customerPhone.replace(/\s/g, '')}`}
                  className="flex min-h-[48px] items-center border-b border-hairline-soft text-[16px] text-ink"
                >
                  Call {data.customerPhone}
                </a>
              )}
              {!isTerminal && (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setStatus('completed')}
                    className="flex min-h-[48px] items-center border-b border-hairline-soft text-left text-[16px] text-ink disabled:opacity-50"
                  >
                    Mark complete
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setStatus('no_show')}
                    className="flex min-h-[48px] items-center border-b border-hairline-soft text-left text-[16px] text-ink disabled:opacity-50"
                  >
                    Mark no-show
                  </button>
                </>
              )}
              <a
                href={`/app/bookings?focus=${data.id}`}
                className="flex min-h-[48px] items-center text-[16px] text-ink"
              >
                View booking
              </a>
            </div>

            {error && <p className="pt-2 text-[13px] text-status-noshow">{error}</p>}

            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-3 min-h-[48px] w-full rounded-xl border border-ink/20 text-[16px] font-semibold text-ink"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
