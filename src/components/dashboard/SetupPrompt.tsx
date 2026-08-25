import Link from 'next/link'

/**
 * Shown until the wizard is finished.
 *
 * Every step after the first is skippable by design, so this is how a
 * half-configured business gets nudged back — a prompt, never a wall. They can
 * take bookings in the meantime.
 */
export function SetupPrompt({ missing }: { missing: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/25 bg-accent-tint px-[18px] py-2.5 md:px-7">
      <p className="text-[14px] leading-[1.45] text-ink">
        <span className="font-semibold">Finish setting up</span>
        {missing.length > 0 && (
          <span className="text-ink-secondary"> — still to add: {missing.join(', ')}</span>
        )}
      </p>
      <Link
        href="/app/setup/business"
        className="flex h-8 flex-none items-center rounded-lg border border-accent/35 bg-surface px-3 text-[13px] leading-none font-semibold text-accent-hover transition-colors hover:bg-surface-subtle"
      >
        Pick up where you left off
      </Link>
    </div>
  )
}
