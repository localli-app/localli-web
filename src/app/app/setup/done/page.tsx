import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getStaffSession } from '@/lib/auth/staff-session'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { CopyLinkButton } from '@/components/dashboard/CopyLinkButton'

/**
 * The end of the wizard.
 *
 * The final push is toward Google Business Profile, because that is the
 * highest-value distribution action available and almost nobody does it
 * unaided. Everything else on this screen is secondary to that one step.
 */
export default async function SetupDonePage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  // Reaching this screen finishes setup even if they skipped their way here,
  // so the dashboard prompt retires rather than nagging forever.
  const business = await db.query.businesses.findFirst({
    where: eq(s.businesses.id, session.businessId),
  })
  if (business && !business.onboardingCompletedAt) {
    await db
      .update(s.businesses)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(s.businesses.id, session.businessId))
  }

  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`

  return (
    <div className="flex justify-center px-[18px] py-8 md:px-7 md:pt-10 md:pb-14">
      <div className="w-full max-w-[760px]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-tint">
          <span
            className="-mt-1.5 block h-[11px] w-[22px] -rotate-45 border-b-[3px] border-l-[3px] border-accent"
            aria-hidden
          />
        </div>

        <h1 className="font-display mt-5 text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] text-ink md:text-[34px]">
          Your booking page is live
        </h1>
        <p className="mt-2.5 text-[16px] leading-[1.5] text-ink-secondary">
          Anyone with this link can book you right now — no app, no account, nothing to install.
        </p>

        <section className="mt-6 rounded-[14px] bg-field p-[22px]">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 truncate rounded-[11px] border border-hairline bg-surface px-4 py-3.5 font-mono text-[17px] leading-[1.1] font-semibold text-ink md:text-[20px]">
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

        <section className="mt-4 rounded-[14px] border border-accent/35 bg-accent-tint p-[22px]">
          <h2 className="text-[16px] leading-none font-semibold text-ink">
            Next: put it on your Google listing
          </h2>
          <p className="mt-2.5 text-[15px] leading-[1.5] text-ink-secondary">
            This is the single highest-value thing you can do with the link. Around half of booking
            demand arrives when you&rsquo;re closed, and a Book button on Google catches it.
          </p>
          <Link
            href="/app/link"
            className="mt-4 inline-flex h-[46px] items-center rounded-[11px] bg-accent px-[22px] text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Show me how
          </Link>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <a
            href="/api/business/booking-link/qr.pdf?s=qr"
            className="flex min-h-[64px] flex-col justify-center rounded-[14px] border border-hairline px-[18px] py-3.5 transition-colors hover:bg-surface-subtle"
          >
            <span className="text-[15px] font-semibold text-ink">Download your QR code</span>
            <span className="text-[13px] text-ink-muted">A5 counter card, print resolution</span>
          </a>
          <Link
            href="/app"
            className="flex min-h-[64px] flex-col justify-center rounded-[14px] border border-hairline px-[18px] py-3.5 transition-colors hover:bg-surface-subtle"
          >
            <span className="text-[15px] font-semibold text-ink">Go to your dashboard</span>
            <span className="text-[13px] text-ink-muted">Today, bookings, and your link</span>
          </Link>
        </section>
      </div>
    </div>
  )
}
