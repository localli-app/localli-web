import Link from 'next/link'
import type { ReactNode } from 'react'
import { CopyLinkButton } from './CopyLinkButton'

/**
 * Persistent at every size: business name, the booking link with a copy button,
 * and Add booking. The copy button is small and gets used constantly.
 */
export function TopBar({
  title,
  subtitle,
  bookingLinkDisplay,
  bookingLinkUrl,
  trailing,
}: {
  title: string
  subtitle?: string
  bookingLinkDisplay: string
  bookingLinkUrl: string
  trailing?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 flex flex-none items-center justify-between gap-3 border-b border-hairline bg-surface px-[18px] py-2.5 md:h-[60px] md:gap-5 md:px-7 md:py-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="font-display text-[20px] leading-[1.1] font-semibold tracking-[-0.015em] text-ink md:text-[18px] md:leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-[13px] text-ink-muted md:text-[14px]">{subtitle}</p>
        )}
      </div>

      <div className="flex flex-none items-center gap-3">
        {/* The link chip is desktop-only; on a phone it lives in the More sheet,
            which keeps the header from crowding out the page title. */}
        <div className="hidden h-9 items-center gap-2.5 rounded-[9px] bg-field pr-1.5 pl-3 lg:flex">
          <span className="font-mono text-[13px] leading-none text-ink-secondary">
            {bookingLinkDisplay}
          </span>
          <CopyLinkButton
            value={bookingLinkUrl}
            className="flex h-[26px] items-center rounded-[7px] border border-ink/15 bg-surface px-2.5 text-[13px] leading-none font-semibold text-ink transition-colors hover:bg-surface-subtle"
          />
        </div>
        {trailing ?? (
          <Link
            href="/app/bookings/new"
            className="flex h-9 items-center rounded-[9px] bg-accent px-4 text-[14px] leading-none font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <span className="hidden sm:inline">Add booking</span>
            <span className="sm:hidden">Add</span>
          </Link>
        )}
      </div>
    </header>
  )
}
