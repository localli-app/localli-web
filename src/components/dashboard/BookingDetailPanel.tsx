import Link from 'next/link'
import type { BookingRow } from '@/lib/dashboard/bookings'
import { presentStatus } from '@/lib/dashboard/status'
import { formatMoney, formatTime } from '@/lib/format'
import { formatInTimeZone } from 'date-fns-tz'

const SOURCE_LABELS: Record<string, string> = {
  gmb: 'Google',
  qr: 'QR code',
  ig: 'Instagram',
  web: 'your website',
  sms: 'SMS',
  direct: 'a direct link',
  manual: 'added by you',
  marketplace: 'the marketplace',
}

function relativeAgo(then: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return `${Math.round(days / 7)} weeks ago`
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[14px] leading-[1.4]">
      <span className="flex-none text-ink-muted">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  )
}

/**
 * Opens BESIDE the table on desktop rather than navigating away, so the owner
 * keeps their place in the list.
 */
export function BookingDetailPanel({
  booking,
  timezone,
  now,
}: {
  booking: BookingRow
  timezone: string
  now: Date
}) {
  const status = presentStatus(booking.status)
  const when = `${formatInTimeZone(booking.startsAt, timezone, 'EEE d MMMM')}, ${formatTime(
    booking.startsAt,
    timezone,
  )}–${formatTime(booking.endsAt, timezone)}`

  return (
    <aside className="flex min-h-[420px] flex-col gap-4 rounded-[14px] border border-hairline p-[22px] lg:rounded-none lg:border-0 lg:border-l">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] leading-[1.25] font-semibold text-ink">{booking.serviceName}</h2>
        <span className="text-[15px] leading-none font-semibold text-ink">
          {formatMoney(booking.priceMinor, booking.currency)}
        </span>
      </div>

      <div
        className={`inline-flex items-center gap-1.5 self-start rounded-[7px] bg-field px-2.5 py-[5px] text-[13px] leading-none ${status.text}`}
      >
        <span className={`h-[7px] w-[7px] rounded-full ${status.dot}`} aria-hidden />
        {status.label}
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <Field label="When" value={when} />
        <Field label="Customer" value={booking.customerName} />
        {booking.customerPhone && <Field label="Phone" value={booking.customerPhone} />}
        <Field label="Staff" value={booking.staffName} />
        {booking.address && <Field label="Address" value={booking.address} />}
        <Field
          label="Booked"
          value={`${relativeAgo(booking.createdAt, now)}, via ${
            SOURCE_LABELS[booking.source] ?? booking.source
          }`}
        />
      </div>

      <div className="rounded-[11px] bg-surface-subtle p-3.5 text-[14px] leading-[1.5] text-ink-secondary">
        {booking.customerNote
          ? `Note from customer: “${booking.customerNote}”`
          : 'No note left.'}
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        {/* Reschedule sits first and larger. A rescheduled appointment is
            retained revenue; a cancelled one is not. */}
        <Link
          href="/app/calendar"
          className="flex h-[42px] items-center justify-center rounded-[10px] bg-accent text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Reschedule
        </Link>
        <div className="flex gap-2.5">
          {booking.customerPhone && (
            <a
              href={`tel:${booking.customerPhone.replace(/\s/g, '')}`}
              className="flex h-10 flex-1 items-center justify-center rounded-[10px] border border-ink/15 bg-surface text-[14px] text-ink transition-colors hover:bg-field"
            >
              Call
            </a>
          )}
          <Link
            href={`/app/customers/${booking.customerId}`}
            className="flex h-10 flex-1 items-center justify-center rounded-[10px] border border-ink/15 bg-surface text-[14px] text-ink transition-colors hover:bg-field"
          >
            Customer
          </Link>
        </div>
      </div>
    </aside>
  )
}
