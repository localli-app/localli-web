import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The setup wizard is a conversion funnel, not an admin form.
 *
 * Target: under fifteen minutes, finishable on a phone, without reading
 * anything. Every step after the first is skippable, and the dashboard carries
 * a "finish setting up" prompt afterwards — a half-configured business that
 * took one booking is worth more than a complete one that never started.
 */

export const WIZARD_STEPS = [
  { key: 'business', href: '/app/setup/business' },
  { key: 'where', href: '/app/setup/where' },
  { key: 'address', href: '/app/setup/address' },
  { key: 'hours', href: '/app/setup/hours' },
  { key: 'services', href: '/app/setup/services' },
  { key: 'team', href: '/app/setup/team' },
] as const

export type WizardStepKey = (typeof WIZARD_STEPS)[number]['key']

export function stepNumber(key: WizardStepKey): number {
  return WIZARD_STEPS.findIndex((s) => s.key === key) + 1
}

export function StepIndicator({ current }: { current: WizardStepKey }) {
  const index = stepNumber(current)
  const total = WIZARD_STEPS.length

  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center" aria-hidden>
        {WIZARD_STEPS.map((step, i) => {
          const number = i + 1
          const done = number < index
          const isCurrent = number === index
          return (
            <span key={step.key} className="flex items-center">
              <span
                className={`rounded-full ${
                  isCurrent
                    ? 'h-3.5 w-3.5 border-[2.5px] border-accent bg-surface'
                    : done
                      ? 'h-3 w-3 bg-accent'
                      : 'h-3 w-3 border-2 border-[#D9CFC2] bg-surface'
                }`}
              />
              {number < total && (
                <span className={`h-0.5 w-5 md:w-11 ${done ? 'bg-accent' : 'bg-[#D9CFC2]'}`} />
              )}
            </span>
          )
        })}
      </span>
      <span className="ml-2 text-[14px] leading-none font-semibold text-ink-muted">
        Step {index} of {total}
      </span>
    </div>
  )
}

export function WizardStep({
  step,
  title,
  lead,
  children,
}: {
  step: WizardStepKey
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <div className="flex justify-center px-[18px] py-8 md:px-7 md:pt-10 md:pb-14">
      <div className="w-full max-w-[760px]">
        <StepIndicator current={step} />
        <h1 className="font-display mt-[26px] text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink md:text-[30px]">
          {title}
        </h1>
        {lead && <p className="mt-2.5 text-[16px] leading-[1.5] text-ink-secondary">{lead}</p>}
        {children}
      </div>
    </div>
  )
}

/** Skip on the left, primary on the right. The primary action is never the only way forward. */
export function WizardActions({
  skipHref,
  children,
  note,
}: {
  skipHref: string
  children: ReactNode
  note?: ReactNode
}) {
  return (
    <div className="mt-[22px] flex flex-wrap items-center justify-between gap-5">
      <Link
        href={skipHref}
        className="text-[14px] leading-none text-ink-muted underline-offset-2 hover:underline"
      >
        Skip for now
      </Link>
      <div className="flex items-center gap-4">
        {note}
        {children}
      </div>
    </div>
  )
}
