/**
 * The four figures across the top of Today.
 *
 * "free in gaps" is the one no incumbent shows: unbooked time inside the
 * working day is lost revenue, and naming it turns a passive calendar into
 * something that prompts action.
 */
export function StatTile({
  figure,
  caption,
  emphasis = false,
}: {
  figure: string
  caption: string
  /** Draws attention to the next appointment, the one time-critical figure. */
  emphasis?: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-[5px] rounded-[11px] px-3.5 py-3 md:gap-[7px] md:rounded-xl md:px-[18px] md:py-4 ${
        emphasis ? 'bg-accent-tint' : 'bg-field'
      }`}
    >
      <span className="font-display text-[20px] leading-none font-semibold tracking-[-0.02em] text-ink md:text-[26px]">
        {figure}
      </span>
      <span className={`text-[13px] leading-none ${emphasis ? 'text-accent-hover' : 'text-ink-muted'}`}>
        {caption}
      </span>
    </div>
  )
}
