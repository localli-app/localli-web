'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, activeKey } from './nav'
import { CopyLinkButton } from './CopyLinkButton'

/**
 * Persistent from 1280px, collapsible from 768px. Hidden below that, where the
 * bottom tab bar takes over.
 */
export function Sidebar({
  businessName,
  bookingLinkDisplay,
  bookingLinkUrl,
  staffName,
  staffRole,
  attentionCount,
}: {
  businessName: string
  bookingLinkDisplay: string
  bookingLinkUrl: string
  staffName: string
  staffRole: string
  attentionCount: number
}) {
  const pathname = usePathname()
  const active = activeKey(pathname)

  return (
    <nav
      aria-label="Dashboard"
      className="hidden w-[232px] flex-none flex-col overflow-y-auto bg-nav py-[22px] md:flex"
    >
      <div className="flex items-center gap-2.5 px-5 pb-[22px]">
        <span className="h-[26px] w-[26px] flex-none rounded-lg bg-accent" aria-hidden />
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="truncate text-[14px] leading-none font-semibold text-white">
            {businessName}
          </span>
          <span className="truncate font-mono text-[12px] leading-none text-white/50">
            {bookingLinkDisplay}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-0.5 px-2.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-[38px] items-center justify-between rounded-[9px] px-3 text-[14px] leading-none transition-colors ${
                isActive
                  ? 'bg-nav-active font-semibold text-white'
                  : 'text-nav-text hover:bg-nav-hover hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={`h-4 w-4 flex-none rounded-[5px] ${
                    isActive ? 'bg-accent' : 'border-[1.5px] border-white/45'
                  }`}
                />
                {item.label}
              </span>
              {item.key === 'bookings' && attentionCount > 0 && (
                <span className="rounded-full bg-badge px-[7px] py-[3px] text-[12px] leading-none font-semibold text-ink">
                  {attentionCount}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <div className="mx-3.5 mt-5 flex flex-col gap-2.5 border-t border-nav-divider pt-4">
        <Link
          href="/app/bookings/new"
          className="flex h-[38px] items-center justify-center rounded-[9px] bg-accent text-[14px] leading-none font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Add booking
        </Link>
        <CopyLinkButton
          value={bookingLinkUrl}
          className="flex h-[38px] items-center justify-center rounded-[9px] border border-white/25 text-[14px] leading-none text-white/85 transition-colors hover:bg-nav-hover"
          label="Copy booking link"
          copiedLabel="Link copied"
        />
      </div>

      <div className="mt-auto px-3.5 pt-6">
        <div className="flex flex-col gap-1.5 rounded-[11px] bg-white/[0.07] px-3 pt-3 pb-3.5">
          <span className="text-[12px] leading-none tracking-[0.04em] text-white/55 uppercase">
            {staffName}
          </span>
          <span className="text-[13px] leading-none text-white/80">
            {staffRole} · {businessName}
          </span>
        </div>
      </div>
    </nav>
  )
}
