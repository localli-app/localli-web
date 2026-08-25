'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MORE_ITEMS, TAB_BAR_ITEMS, activeKey } from './nav'
import { CopyLinkButton } from './CopyLinkButton'
import { SignOutButton } from './SignOutButton'

/**
 * Phone navigation, under 768px. Five destinations here, the remaining three
 * behind More — repositioned, never removed.
 */
export function MobileTabBar({ bookingLinkUrl }: { bookingLinkUrl: string }) {
  const pathname = usePathname()
  const active = activeKey(pathname)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const moreIsActive = MORE_ITEMS.some((i) => i.key === active)

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-ink/35 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            role="dialog"
            aria-label="More"
            className="w-full rounded-t-[20px] bg-surface px-[18px] pt-2.5 pb-[max(1.375rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3.5 h-1 w-[38px] rounded-sm bg-ink/20" aria-hidden />
            <div className="flex flex-col">
              {MORE_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  // Dismiss on the way out rather than reacting to the route
                  // change afterwards, which would be a render-cascading effect.
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-[52px] items-center justify-between border-b border-hairline-soft text-[16px] text-ink"
                >
                  {item.label}
                  <span className="text-ink-faint" aria-hidden>
                    ›
                  </span>
                </Link>
              ))}
              <CopyLinkButton
                value={bookingLinkUrl}
                className="flex min-h-[52px] w-full items-center justify-between border-b border-hairline-soft text-left text-[16px] text-ink"
                label="Copy booking link"
                copiedLabel="Link copied"
              />
              <Link
                href="/app/settings/sessions"
                onClick={() => setMoreOpen(false)}
                className="flex min-h-[52px] items-center justify-between border-b border-hairline-soft text-[16px] text-ink"
              >
                Devices
                <span className="text-ink-faint" aria-hidden>
                  ›
                </span>
              </Link>
              <SignOutButton className="flex min-h-[52px] w-full items-center text-left text-[16px] text-ink" />
            </div>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="mt-3 min-h-[48px] w-full rounded-xl border border-ink/20 text-[16px] font-semibold text-ink"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Dashboard"
        className="sticky bottom-0 z-30 flex items-stretch border-t border-hairline bg-surface-subtle px-1 pt-1.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {TAB_BAR_ITEMS.map((item) => {
          const isActive = item.key === active && !moreOpen
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[5px]"
            >
              <span
                aria-hidden
                className={`h-5 w-5 rounded-md ${
                  isActive ? 'bg-accent' : 'border-[1.5px] border-[#8C857D]'
                }`}
              />
              <span
                className={`text-[12px] leading-none ${
                  isActive ? 'font-semibold text-accent' : 'text-ink-muted'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[5px]"
        >
          <span
            aria-hidden
            className={`h-5 w-5 rounded-md ${
              moreOpen || moreIsActive ? 'bg-accent' : 'border-[1.5px] border-[#8C857D]'
            }`}
          />
          <span
            className={`text-[12px] leading-none ${
              moreOpen || moreIsActive ? 'font-semibold text-accent' : 'text-ink-muted'
            }`}
          >
            More
          </span>
        </button>
      </nav>
    </>
  )
}
