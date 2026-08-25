'use client'

import { useState } from 'react'
import { formatLongDateTime, formatMoney } from '@/lib/format'

export interface ConfirmedBooking {
  id: string
  accessToken: string
  startsAt: string
  service: { name: string }
  staff: { name: string }
  business: { name: string; phone: string | null }
  price: { amountMinor: number; currency: string }
  manageUrl: string
  icsUrl: string
}

/**
 * Artboard 1g — confirmation.
 *
 * The save-details offer sits BELOW the useful content, is soft, single, and
 * dismissible. It is an offer, never a gate: the booking is already complete.
 */
export function ConfirmedScreen({
  booking,
  timezone,
  whereLine,
  contactLabel,
}: {
  booking: ConfirmedBooking
  timezone: string
  whereLine: string | null
  contactLabel: string | null
}) {
  const [saveVisible, setSaveVisible] = useState(true)

  const mapsQuery = encodeURIComponent(whereLine ?? booking.business.name)

  return (
    <>
      <div className="px-5 pt-7">
        <div
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-tint"
        >
          <span className="-mt-1.5 block h-[11px] w-[22px] -rotate-45 border-b-[3px] border-l-[3px] border-accent" />
        </div>

        <h1 className="font-display mt-5 mb-0 text-[34px] leading-[1.1] font-semibold tracking-[-0.025em] text-ink">
          You&rsquo;re booked
        </h1>

        <div className="mt-[22px] flex flex-col gap-2">
          <div className="text-[17px] leading-[1.3] font-semibold text-ink">
            {booking.service.name} with {booking.staff.name}
          </div>
          <div className="text-[17px] leading-[1.4] text-ink-secondary">
            {formatLongDateTime(new Date(booking.startsAt), timezone)}
          </div>
          {whereLine ? (
            <div className="text-[17px] leading-[1.4] text-ink-secondary">{whereLine}</div>
          ) : null}
          <div className="text-[17px] leading-[1.4] font-semibold text-ink">
            {formatMoney(booking.price.amountMinor, booking.price.currency)}, pay at your
            appointment
          </div>
        </div>

        <div className="mt-6 flex gap-2.5">
          <a
            href={booking.icsUrl}
            className="flex h-12 flex-1 items-center justify-center rounded-[14px] border border-border-strong text-[17px] text-ink transition-colors hover:bg-surface-subtle"
          >
            Add to calendar
          </a>
          <a
            href={`https://maps.google.com/?q=${mapsQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 flex-1 items-center justify-center rounded-[14px] border border-border-strong text-[17px] text-ink transition-colors hover:bg-surface-subtle"
          >
            Get directions
          </a>
        </div>

        {contactLabel ? (
          <p className="mt-[22px] mb-0 text-[17px] leading-[1.5] text-ink-muted">
            We&rsquo;ve sent the details to {contactLabel}
          </p>
        ) : null}

        {saveVisible ? (
          <div className="mt-[26px] flex items-center justify-between gap-3 rounded-[14px] bg-surface-subtle px-[18px] py-4">
            <span className="text-[17px] leading-[1.4] text-ink-secondary">
              Save your details for next time?
            </span>
            <span className="flex items-center gap-1.5">
              {/*
                Deliberately NOT an account: the device is already recognised via
                the ll_device cookie set at booking. This only acknowledges it.
              */}
              <button
                type="button"
                onClick={() => setSaveVisible(false)}
                className="min-h-[44px] text-[17px] leading-none text-accent"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setSaveVisible(false)}
                aria-label="Dismiss"
                className="min-h-[44px] min-w-[44px] text-[17px] leading-none text-ink-muted"
              >
                ✕
              </button>
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-11 border-t border-hairline-soft bg-surface px-5 pt-[18px] pb-[max(1.875rem,env(safe-area-inset-bottom))] text-center">
        <a href={booking.manageUrl} className="text-[17px] leading-none text-accent">
          Manage this booking
        </a>
        <div className="mt-[18px] text-[12px] leading-none text-ink-secondary">
          Powered by Localli
        </div>
      </div>
    </>
  )
}
