import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { getStaffSession } from '@/lib/auth/staff-session'
import { getBookingsList, type BookingsTab } from '@/lib/dashboard/bookings'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { presentStatus } from '@/lib/dashboard/status'
import { formatMoney } from '@/lib/format'
import { TopBar } from '@/components/dashboard/TopBar'
import { BookingDetailPanel } from '@/components/dashboard/BookingDetailPanel'

const TABS: { key: BookingsTab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
]

const SOURCE_LABELS: Record<string, string> = {
  gmb: 'Google',
  qr: 'QR',
  ig: 'Instagram',
  web: 'Website',
  sms: 'SMS',
  direct: 'Direct',
  manual: 'Manual',
  marketplace: 'Marketplace',
}

/**
 * The list view — past, present and future, which is what a calendar is bad at.
 *
 * Tabs and row selection travel in the URL rather than client state, so the
 * screen stays server-rendered, the back button works, and an owner can send a
 * colleague a link to the exact row they are looking at.
 */
export default async function BookingsPage({ searchParams }: PageProps<'/app/bookings'>) {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const params = await searchParams
  const rawTab = typeof params.tab === 'string' ? params.tab : 'upcoming'
  const tab: BookingsTab = TABS.some((t) => t.key === rawTab) ? (rawTab as BookingsTab) : 'upcoming'
  const focus = typeof params.focus === 'string' ? params.focus : null

  const now = new Date()
  const { rows, totalCount, totalValueMinor, currency } = await getBookingsList({
    businessId: session.businessId,
    tab,
    now,
  })

  const selected = rows.find((r) => r.id === focus) ?? rows[0] ?? null
  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`
  const tz = session.timezone

  return (
    <>
      <TopBar
        title="Bookings"
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
      />

      <div className="flex gap-6 border-b border-hairline px-[18px] md:px-7">
        {TABS.map((t) => {
          const isActive = t.key === tab
          return (
            <Link
              key={t.key}
              href={`/app/bookings?tab=${t.key}`}
              aria-current={isActive ? 'page' : undefined}
              className={`border-b-2 px-0 pt-3.5 pb-3 text-[14px] leading-none font-semibold transition-colors ${
                isActive ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState slug={session.businessSlug} tab={tab} />
      ) : (
        <>
          <div className="flex items-center gap-2.5 overflow-x-auto border-b border-hairline-soft bg-surface-subtle px-[18px] py-3.5 md:px-7">
            <span className="flex h-8 flex-none items-center rounded-lg border border-ink/15 bg-surface px-3 text-[13px] leading-none text-ink">
              All statuses
            </span>
            <span className="flex h-8 flex-none items-center rounded-lg border border-ink/15 bg-surface px-3 text-[13px] leading-none text-ink">
              All staff
            </span>
            <span className="flex h-8 flex-none items-center rounded-lg border border-ink/15 bg-surface px-3 text-[13px] leading-none text-ink">
              All services
            </span>
            <span className="ml-auto flex-none pl-3 text-[13px] leading-none whitespace-nowrap text-ink-muted">
              {totalCount} booking{totalCount === 1 ? '' : 's'} ·{' '}
              {formatMoney(totalValueMinor, currency)}
            </span>
          </div>

          <div className="grid flex-1 grid-cols-1 items-start lg:grid-cols-[1fr_372px]">
            <div className="min-w-0">
              {/* Wide table scrolls inside its own container; the page itself
                  never scrolls horizontally at any size. */}
              <div className="hidden overflow-x-auto md:block">
                {/*
                  Eight columns plus a 372px detail panel does not fit at 1280,
                  which is the desktop breakpoint itself. Rather than ellipsing
                  the customer's name — the column the owner actually scans —
                  STAFF and SOURCE drop out until there is room, per the spec's
                  rule for constrained widths. Nothing is lost: both are in the
                  detail panel.
                */}
                <div className="min-w-[620px] 2xl:min-w-[760px]">
                  <div className="grid grid-cols-[76px_62px_1.4fr_1.4fr_112px_72px] gap-3 border-b border-hairline py-[11px] pr-5 pl-7 text-[12px] leading-none font-semibold tracking-[0.05em] text-ink-muted 2xl:grid-cols-[88px_74px_1.25fr_1.3fr_78px_84px_128px_76px]">
                    <span>DATE</span>
                    <span>TIME</span>
                    <span>CUSTOMER</span>
                    <span>SERVICE</span>
                    <span className="hidden 2xl:block">STAFF</span>
                    <span className="hidden 2xl:block">SOURCE</span>
                    <span>STATUS</span>
                    <span className="text-right">VALUE</span>
                  </div>
                  {rows.map((row) => {
                    const status = presentStatus(row.status)
                    const isSelected = selected?.id === row.id
                    return (
                      <Link
                        key={row.id}
                        href={`/app/bookings?tab=${tab}&focus=${row.id}`}
                        scroll={false}
                        style={{ borderLeftWidth: 3 }}
                        className={`grid grid-cols-[76px_62px_1.4fr_1.4fr_112px_72px] items-center gap-3 border-b border-hairline-soft py-3.5 pr-5 pl-7 text-[14px] leading-[1.3] text-ink-secondary transition-colors 2xl:grid-cols-[88px_74px_1.25fr_1.3fr_78px_84px_128px_76px] ${status.borderLeft} ${
                          isSelected ? 'bg-accent-tint' : 'bg-surface hover:bg-surface-subtle'
                        }`}
                      >
                        <span className="text-ink">
                          {formatInTimeZone(row.startsAt, tz, 'd MMM')}
                        </span>
                        <span>{formatInTimeZone(row.startsAt, tz, 'HH:mm')}</span>
                        <span className="truncate font-semibold text-ink">{row.customerName}</span>
                        <span className="truncate">{row.serviceName}</span>
                        <span className="hidden truncate 2xl:block">{row.staffName}</span>
                        <span className="hidden truncate 2xl:block">
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-[13px] ${status.text}`}>
                          <span className={`h-[7px] w-[7px] flex-none rounded-full ${status.dot}`} aria-hidden />
                          <span className="truncate">{status.shortLabel}</span>
                        </span>
                        <span className="text-right font-semibold text-ink">
                          {formatMoney(row.priceMinor, row.currency)}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Phone: the same rows as stacked cards. */}
              <div className="flex flex-col gap-2.5 p-[18px] md:hidden">
                {rows.map((row) => {
                  const status = presentStatus(row.status)
                  return (
                    <Link
                      key={row.id}
                      href={`/app/bookings?tab=${tab}&focus=${row.id}`}
                      className={`flex flex-col gap-1.5 rounded-xl border border-hairline p-3.5 ${status.borderLeft}`}
                      style={{ borderLeftWidth: 3 }}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[15px] leading-[1.2] font-semibold text-ink">
                          {row.customerName}
                        </span>
                        <span className="text-[14px] leading-none font-semibold text-ink">
                          {formatMoney(row.priceMinor, row.currency)}
                        </span>
                      </span>
                      <span className="text-[14px] text-ink-secondary">
                        {row.serviceName} · {row.staffName}
                      </span>
                      <span className="text-[13px] text-ink-muted">
                        {formatInTimeZone(row.startsAt, tz, 'EEE d MMM, HH:mm')}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 text-[13px] ${status.text}`}>
                        <span className={`h-[7px] w-[7px] rounded-full ${status.dot}`} aria-hidden />
                        {status.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {selected && (
              <div className="px-[18px] pb-6 lg:h-full lg:px-0 lg:pb-0">
                <BookingDetailPanel booking={selected} timezone={tz} now={now} />
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

function EmptyState({ slug, tab }: { slug: string; tab: BookingsTab }) {
  if (tab !== 'upcoming') {
    return (
      <div className="flex flex-col items-center gap-3 px-10 py-14 text-center">
        <p className="font-display text-[18px] leading-[1.3] font-semibold text-ink">
          Nothing here yet
        </p>
        <p className="max-w-[400px] text-[14px] leading-[1.55] text-ink-secondary">
          {tab === 'past'
            ? 'Completed appointments will appear here after they happen.'
            : 'Cancellations and no-shows will appear here.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3.5 px-10 pt-14 pb-[60px] text-center">
      <div
        className="flex h-[120px] w-[120px] items-center justify-center rounded-[14px] bg-field"
        aria-hidden
      >
        <div className="h-16 w-16 bg-[repeating-conic-gradient(#C9BFB2_0_25%,#F3EEE7_0_50%)] bg-[length:16px_16px]" />
      </div>
      <p className="font-display text-[18px] leading-[1.3] font-semibold text-ink">
        No bookings yet
      </p>
      <p className="max-w-[400px] text-[14px] leading-[1.55] text-ink-secondary">
        Bookings appear here the moment someone uses your link. Most businesses get their first one
        within a day of putting it on their Google listing.
      </p>
      <div className="mt-1.5 flex flex-col gap-2.5 sm:flex-row">
        <Link
          href="/app/link"
          className="flex h-[42px] items-center justify-center rounded-[10px] bg-accent px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Put your link on Google
        </Link>
        <Link
          href={`/${slug}`}
          target="_blank"
          className="flex h-[42px] items-center justify-center rounded-[10px] border border-ink/15 bg-surface px-[18px] text-[14px] text-ink transition-colors hover:bg-surface-subtle"
        >
          Add a booking yourself
        </Link>
      </div>
    </div>
  )
}
