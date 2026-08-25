'use client'

import { useState } from 'react'
import type { ManagedBooking } from '@/lib/booking/manage'
import { formatLongDateTime, formatMoney, formatPhoneForDisplay } from '@/lib/format'
import { ActionBar, Screen, ScreenTitle, SummaryCard } from './primitives'

type Props = { booking: ManagedBooking & { accessToken: string } }

const CANCELLED_LABEL: Record<string, string> = {
  cancelled_by_customer: 'This booking was cancelled.',
  cancelled_by_business: `This booking was cancelled by the salon.`,
  completed: 'This appointment is complete.',
  no_show: 'This appointment was marked as missed.',
}

/**
 * Artboard 1i.
 *
 * Reschedule is offered FIRST and larger than cancel: a rescheduled
 * appointment is retained revenue and a cancelled one is not.
 */
export function ManageBookingScreen({ booking }: Props) {
  const [status, setStatus] = useState(booking.status)
  const [cancelling, setCancelling] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const terminalMessage = CANCELLED_LABEL[status]

  async function cancel() {
    setCancelling(true)
    setError(null)
    try {
      const response = await fetch(`/api/public/bookings/${booking.accessToken}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: null }),
      })
      const payload = (await response.json()) as {
        data?: { status: string }
        error?: { message: string }
      }
      if (payload.data) setStatus(payload.data.status)
      else setError(payload.error?.message ?? 'We could not cancel that. Please call the salon.')
    } catch {
      setError('We could not reach Localli. Please try again.')
    } finally {
      setCancelling(false)
      setConfirmingCancel(false)
    }
  }

  return (
    <Screen>
      <div className="px-5 pt-[18px]">
        <ScreenTitle>Your booking</ScreenTitle>

        <div className="mt-5">
          <SummaryCard>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] leading-[1.3] font-semibold text-ink">
                {booking.serviceName} with {booking.staffName}
              </span>
              <span className="text-[17px] leading-none font-semibold text-ink">
                {formatMoney(booking.priceMinor, booking.currency)}
              </span>
            </div>
            <div className="text-[17px] leading-[1.4] text-ink-secondary">
              {formatLongDateTime(booking.startsAt, booking.timezone)}
            </div>
            {booking.serviceAddress ? (
              <div className="text-[17px] leading-[1.4] text-ink-secondary">
                {booking.serviceAddress}
              </div>
            ) : null}
            <div className="text-[17px] leading-[1.4] text-ink-muted">
              {booking.businessName}
              {booking.businessPhone ? ` · ${formatPhoneForDisplay(booking.businessPhone)}` : ''}
            </div>
          </SummaryCard>
        </div>

        {terminalMessage ? (
          <p className="mt-5 mb-0 px-0.5 text-[17px] leading-[1.5] text-ink-secondary">
            {terminalMessage}{' '}
            {status.startsWith('cancelled') ? (
              <a href={`/${booking.businessSlug}`} className="text-accent">
                Book again
              </a>
            ) : null}
          </p>
        ) : (
          <p className="mt-5 mb-0 px-0.5 text-[17px] leading-[1.5] text-ink-muted text-pretty">
            Free cancellation up to {booking.cancellationWindowHours} hours before. No account or
            password needed to change this.
          </p>
        )}

        {booking.lateCancellationFeeMinor > 0 && !terminalMessage ? (
          <p className="mt-3 mb-0 px-0.5 text-[17px] leading-[1.5] text-ink-secondary">
            Cancelling now is outside the free window, so a{' '}
            {formatMoney(booking.lateCancellationFeeMinor, booking.currency)} fee applies.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 mb-0 px-0.5 text-[17px] leading-[1.4] text-accent" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {!terminalMessage ? (
        <ActionBar>
          {confirmingCancel ? (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-[17px] leading-[1.5] text-ink text-pretty">
                Cancel this appointment?
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="flex h-12 flex-1 items-center justify-center rounded-[14px] border border-border-strong text-[17px] text-ink hover:bg-surface-subtle"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={cancelling}
                  className="flex h-12 flex-1 items-center justify-center rounded-[14px] border border-border-strong text-[17px] text-ink hover:bg-surface-subtle disabled:opacity-40"
                >
                  {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Reschedule first and larger — retained revenue beats a refund. */}
              <a
                href={`/${booking.businessSlug}`}
                className="flex h-14 w-full items-center justify-center rounded-[14px] bg-accent text-[17px] font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Reschedule
              </a>
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="inline-flex min-h-[44px] items-center justify-center px-4 text-[17px] leading-none text-ink-muted"
                >
                  Cancel booking
                </button>
              </div>
            </>
          )}
        </ActionBar>
      ) : null}
    </Screen>
  )
}
