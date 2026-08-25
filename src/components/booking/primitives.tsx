import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Shared controls from the design canvas.
 *
 * Two rules the artboards hold to everywhere, worth stating because they are
 * easy to erode: exactly ONE terracotta primary action per screen, and no
 * shadows anywhere — separation comes from hairlines and surface tint.
 */

/**
 * The screen. On a phone this is the viewport; on a wider display the design is
 * a 375px column, so it is centred rather than stretched.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface">
      {children}
    </main>
  )
}

/**
 * The sticky bottom action area. The primary action always sits in the bottom
 * third and stays reachable one-handed.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 mt-auto border-t border-hairline-soft bg-surface px-5 pt-4 pb-[max(1.875rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }

export function PrimaryButton({ children, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`flex h-[52px] w-full items-center justify-center rounded-[14px] bg-accent text-[17px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`flex h-12 w-full items-center justify-center rounded-[14px] border border-border-strong text-[17px] text-ink transition-colors hover:bg-surface-subtle ${className}`}
    >
      {children}
    </button>
  )
}

/** A quiet text action. Still 44px tall, so it stays tappable. */
export function TextButton({ children, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`flex min-h-[44px] items-center text-[17px] text-accent ${className}`}
    >
      {children}
    </button>
  )
}

/** Uppercase section label above a grouped list. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="pt-6 pb-1.5 text-[13px] font-semibold tracking-[0.07em] text-ink-muted">
      {children}
    </div>
  )
}

export function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-display m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink">
      {children}
    </h1>
  )
}

/**
 * The service/price bar carried across every step after selection.
 * The price is never hidden — revealing it late reads as a bait and switch.
 */
export function ServiceSummaryBar({
  serviceName,
  detail,
  price,
}: {
  serviceName: string
  detail: string
  price: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 pt-1.5 pb-3.5">
      <span className="flex flex-col gap-[3px]">
        <span className="text-[17px] leading-[1.2] font-semibold text-ink">{serviceName}</span>
        <span className="text-[17px] leading-none text-ink-muted">{detail}</span>
      </span>
      <span className="text-[17px] leading-none font-semibold text-ink">{price}</span>
    </div>
  )
}

/** A read-only recap block on the warm field tint. */
export function SummaryCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] bg-field p-[18px]">{children}</div>
  )
}
