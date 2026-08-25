import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { getBookingsBySource } from '@/lib/dashboard/bookings'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { channelLinks } from '@/lib/dashboard/qr'
import { TopBar } from '@/components/dashboard/TopBar'
import { CopyLinkButton } from '@/components/dashboard/CopyLinkButton'
import { SourceChart } from '@/components/dashboard/SourceChart'

/**
 * Strategically the most important dashboard screen, and the one most booking
 * products bury in settings. It gets a full destination in the nav.
 */
export default async function YourLinkPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const base = appBaseUrl()
  const bookingLinkUrl = `${base}/${session.businessSlug}`
  const channels = channelLinks(base, session.businessSlug)

  const sources = await getBookingsBySource({ businessId: session.businessId, withinDays: 30 })
  const total = sources.reduce((sum, s) => sum + s.count, 0)

  return (
    <>
      <TopBar
        title="Your link"
        subtitle={
          total > 0
            ? `${total} booking${total === 1 ? '' : 's'} from your link in the last 30 days`
            : undefined
        }
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
      />

      <div className="flex-1">
        <div className="grid grid-cols-1 items-start gap-5 px-[18px] py-5 lg:grid-cols-[1fr_380px] lg:gap-[22px] lg:px-7 lg:py-6">
          <div className="flex flex-col gap-5">
            <section className="rounded-[14px] bg-field p-[22px]">
              <h2 className="text-[13px] leading-none tracking-[0.05em] text-ink-muted uppercase">
                Your booking link
              </h2>
              <div className="mt-3.5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 truncate rounded-[11px] border border-hairline bg-surface px-4 py-3.5 font-mono text-[17px] leading-[1.1] font-semibold text-ink md:text-[22px]">
                  {displayLink(bookingLinkUrl)}
                </div>
                <CopyLinkButton
                  value={bookingLinkUrl}
                  className="flex h-[50px] items-center justify-center rounded-[11px] bg-accent px-5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover"
                  copiedLabel="Copied"
                />
                <Link
                  href={`/${session.businessSlug}`}
                  target="_blank"
                  className="flex h-[50px] items-center justify-center rounded-[11px] border border-ink/15 bg-surface px-[18px] text-[15px] text-ink transition-colors hover:bg-surface-subtle"
                >
                  Preview
                </Link>
              </div>
            </section>

            <section>
              <h2 className="text-[14px] leading-none font-semibold tracking-[0.06em] text-ink-muted">
                PER-CHANNEL LINKS
              </h2>
              {/* Every link is attributed, which is what makes the chart below possible. */}
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {channels.map((channel) => (
                  <div
                    key={channel.key}
                    className="flex items-center justify-between gap-3 rounded-[11px] border border-hairline px-3.5 py-3.5"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-[14px] leading-none font-semibold text-ink">
                        {channel.label}
                      </span>
                      <span className="truncate font-mono text-[13px] leading-none text-ink-muted">
                        …/{session.businessSlug}?s={channel.key}
                      </span>
                    </span>
                    <CopyLinkButton
                      value={channel.url}
                      className="flex h-[30px] flex-none items-center rounded-lg border border-ink/15 px-[11px] text-[13px] leading-none text-ink transition-colors hover:bg-field"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[14px] border border-hairline bg-surface-subtle px-[22px] py-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[15px] leading-none font-semibold text-ink">Where to put it</h2>
                <span className="text-[13px] leading-none text-ink-muted">4 places</span>
              </div>
              <div className="mt-3.5 flex flex-col">
                {[
                  {
                    label: 'Book button on your Google listing',
                    emphasis: true,
                    help: 'Show me how',
                  },
                  { label: 'QR code on the counter', emphasis: false, help: null },
                  { label: 'Instagram bio', emphasis: false, help: null },
                  { label: 'Link on your website', emphasis: false, help: null },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex min-h-[42px] items-center justify-between gap-3 border-b border-hairline-soft last:border-b-0"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="h-[18px] w-[18px] flex-none rounded-md border-[1.5px] border-ink/30"
                        aria-hidden
                      />
                      <span
                        className={`text-[14px] leading-none ${
                          item.emphasis ? 'font-semibold text-ink' : 'text-ink-secondary'
                        }`}
                      >
                        {item.label}
                      </span>
                    </span>
                    {item.help && (
                      <span className="flex h-8 flex-none items-center rounded-lg border border-accent/35 bg-surface px-3 text-[13px] leading-none font-semibold text-accent-hover">
                        {item.help}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3.5 text-[13px] leading-[1.5] text-ink-muted">
                The Google step is the highest-value thing you can do with this link, and it takes
                about two minutes.
              </p>
            </section>

            <SourceChart sources={sources} />
          </div>

          <section className="flex flex-col items-center gap-4 rounded-[14px] bg-field p-[22px]">
            <h2 className="self-stretch text-[13px] leading-none tracking-[0.05em] text-ink-muted uppercase">
              QR code
            </h2>
            <div className="flex h-[216px] w-[216px] items-center justify-center rounded-xl border border-hairline bg-surface">
              {/* Generated server-side; never a third-party script on this page. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/api/business/booking-link/qr.png?s=qr&inline=1"
                alt={`QR code linking to ${displayLink(bookingLinkUrl)}`}
                width={168}
                height={168}
                className="h-[168px] w-[168px]"
              />
            </div>
            <p className="text-center text-[13px] leading-[1.5] text-ink-secondary">
              Scans to {displayLink(bookingLinkUrl)}?s=qr
            </p>
            <div className="flex w-full flex-col gap-2.5">
              <a
                href="/api/business/booking-link/qr.png?s=qr"
                className="flex h-11 items-center justify-center rounded-[11px] border border-ink/15 bg-surface text-[14px] font-semibold text-ink transition-colors hover:bg-surface-subtle"
              >
                Download PNG
              </a>
              <a
                href="/api/business/booking-link/qr.pdf?s=qr"
                className="flex h-11 items-center justify-center rounded-[11px] border border-ink/15 bg-surface text-[14px] font-semibold text-ink transition-colors hover:bg-surface-subtle"
              >
                Download print PDF
              </a>
            </div>
            <p className="w-full border-t border-hairline pt-3.5 text-[13px] leading-[1.5] text-ink-muted">
              The print PDF is an A5 counter card with your name and &ldquo;Book with us&rdquo;
              already set.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
