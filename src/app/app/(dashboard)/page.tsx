import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { getTodayView } from '@/lib/dashboard/today'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { formatGapLength } from '@/lib/dashboard/status'
import { formatMoney, formatTime, localDateOf } from '@/lib/format'
import { TopBar } from '@/components/dashboard/TopBar'
import { StatTile } from '@/components/dashboard/StatTile'
import { AgendaRow } from '@/components/dashboard/AgendaRow'
import { GapRow } from '@/components/dashboard/GapRow'
import { formatInTimeZone } from 'date-fns-tz'

const SOURCE_LABELS: Record<string, string> = {
  gmb: 'Google',
  qr: 'the QR code',
  ig: 'Instagram',
  web: 'your website',
  sms: 'SMS',
  direct: 'a direct link',
  manual: 'you',
  marketplace: 'the marketplace',
}

export default async function TodayPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const now = new Date()
  const date = localDateOf(now, session.timezone)
  const view = await getTodayView({
    businessId: session.businessId,
    timezone: session.timezone,
    date,
    now,
  })

  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`
  const tz = session.timezone
  const showStaffOnGaps = view.staffNames.length > 1

  const nextFigure = view.stats.next ? formatTime(view.stats.next.at, tz) : '—'
  const nextCaption = view.stats.next
    ? `${view.stats.next.customerName}, in ${formatGapLength(Math.max(0, view.stats.next.minutesAway))}`
    : 'nothing left today'

  return (
    <>
      <TopBar
        title="Today"
        subtitle={formatInTimeZone(now, tz, 'EEEE d MMMM')}
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
      />

      <div className="flex-1">
        <div className="grid grid-cols-2 gap-2.5 px-[18px] pt-4 md:grid-cols-4 md:gap-3.5 md:px-7 md:pt-[22px]">
          <StatTile
            figure={`${view.stats.bookingCount} booking${view.stats.bookingCount === 1 ? '' : 's'}`}
            caption="today"
          />
          <StatTile
            figure={formatMoney(view.stats.revenueMinor, view.stats.currency)}
            caption="booked today"
          />
          <StatTile figure={nextFigure} caption={nextCaption} emphasis />
          <StatTile
            figure={view.stats.freeGapMinutes > 0 ? formatGapLength(view.stats.freeGapMinutes) : 'None'}
            caption="free in gaps"
          />
        </div>

        <div className="flex flex-col gap-2.5 px-[18px] py-5 md:gap-2.5 md:px-7 md:py-[26px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] leading-none font-semibold tracking-[0.06em] text-ink-muted">
              AGENDA
            </h2>
            <span className="text-[13px] leading-none text-ink-muted">
              {view.staffNames.length > 1
                ? `All staff · ${view.staffNames.join(', ')}`
                : view.staffNames[0]}
              {view.stats.totalDriveMinutes != null && view.stats.totalDriveMinutes > 0 && (
                <> · {formatGapLength(view.stats.totalDriveMinutes)} driving</>
              )}
            </span>
          </div>

          {view.entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-hairline px-6 py-14 text-center">
              <p className="font-display text-[18px] leading-[1.3] font-semibold text-ink">
                Nothing booked today
              </p>
              <p className="max-w-[380px] text-[14px] leading-[1.55] text-ink-secondary">
                When someone books through your link it appears here straight away.
              </p>
            </div>
          ) : (
            view.entries.map((entry) =>
              entry.kind === 'gap' ? (
                <GapRow
                  key={`gap-${entry.startsAt.toISOString()}-${entry.staffName}`}
                  startLabel={formatInTimeZone(entry.startsAt, tz, 'HH:mm')}
                  endLabel={formatInTimeZone(entry.endsAt, tz, 'HH:mm')}
                  lengthLabel={formatGapLength(entry.minutes)}
                  fits={entry.fits}
                  staffName={entry.staffName}
                  showStaff={showStaffOnGaps}
                  offerHref={`/${session.businessSlug}?s=direct`}
                />
              ) : (
                <div key={entry.id} className="flex flex-col gap-2.5">
                  <AgendaRow
                    data={{
                      id: entry.id,
                      startLabel: formatInTimeZone(entry.startsAt, tz, 'HH:mm'),
                      endLabel: formatInTimeZone(entry.endsAt, tz, 'HH:mm'),
                      durationMinutes: entry.durationMinutes,
                      status: entry.status,
                      serviceName: entry.serviceName,
                      priceLabel: formatMoney(entry.priceMinor, entry.currency),
                      customerName: entry.customerName,
                      customerPhone: entry.customerPhone,
                      staffName: entry.staffName,
                      address: entry.address,
                      spanLabel: `${formatTime(entry.startsAt, tz)}–${formatTime(entry.endsAt, tz)}`,
                      sourceLabel: SOURCE_LABELS[entry.source] ?? entry.source,
                    }}
                  />
                  {entry.driveToNextMinutes != null && entry.driveToNextMinutes > 0 && (
                    <div className="flex items-center gap-2.5 pl-[60px] text-[13px] leading-none text-ink-muted md:pl-[76px]">
                      <span className="h-4 w-px bg-ink/20" aria-hidden />
                      {entry.driveToNextMinutes} min drive to next
                    </div>
                  )}
                </div>
              ),
            )
          )}
        </div>
      </div>
    </>
  )
}
