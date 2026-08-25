import Link from 'next/link'

/**
 * A free gap, drawn as an object with an action on it rather than as empty
 * space. Unbooked time inside the working day is lost revenue; making it a
 * thing on the screen is what prompts the owner to do something about it.
 */
export function GapRow({
  startLabel,
  endLabel,
  lengthLabel,
  fits,
  staffName,
  showStaff,
  offerHref,
}: {
  startLabel: string
  endLabel: string
  lengthLabel: string
  fits: { name: string; durationMinutes: number }[]
  staffName: string
  showStaff: boolean
  offerHref: string
}) {
  // Naming what actually fits is the difference between "there is a hole here"
  // and "you could sell this".
  const suggestion =
    fits.length === 0
      ? null
      : `Room for a ${fits
          .slice(0, 2)
          .map((f) => `${f.name} (${f.durationMinutes} min)`)
          .join(' or a ')}`

  return (
    <div className="flex gap-3 rounded-xl border border-dashed border-accent/40 bg-accent-tint px-3 py-3.5 md:gap-4">
      <div className="flex w-12 flex-none flex-col justify-between py-px font-mono text-[13px] leading-none text-accent-hover md:w-14">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] leading-[1.2] font-semibold text-ink">
            {lengthLabel} free{showStaff ? ` · ${staffName}` : ''}
          </span>
          {suggestion && (
            <span className="text-[13px] leading-[1.4] text-accent-hover">{suggestion}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={offerHref}
            className="flex min-h-[44px] items-center rounded-lg border border-accent/35 bg-surface px-3.5 text-[13px] leading-none font-semibold text-accent-hover transition-colors hover:bg-accent-tint md:min-h-[32px]"
          >
            Offer this slot
          </Link>
          <Link
            href="/app/calendar"
            className="flex min-h-[44px] items-center rounded-lg border border-ink/15 bg-surface px-3.5 text-[13px] leading-none text-ink transition-colors hover:bg-field md:min-h-[32px]"
          >
            Block out
          </Link>
        </div>
      </div>
    </div>
  )
}
