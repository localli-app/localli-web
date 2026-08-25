import type { SourceCount } from '@/lib/dashboard/bookings'

/** Ramped down from the accent, so the leading source reads first. */
const BAR_COLOURS = ['bg-[#A8481F]', 'bg-[#C06438]', 'bg-[#D08A5E]', 'bg-[#E0B292]']

/**
 * Bookings by source.
 *
 * Google does not report performance for custom booking links, so this is a
 * number only Localli can hand the business. It is the differentiated bit —
 * make it prominent and make it look good.
 */
export function SourceChart({ sources }: { sources: SourceCount[] }) {
  const total = sources.reduce((sum, s) => sum + s.count, 0)
  const max = Math.max(1, ...sources.map((s) => s.count))

  return (
    <section className="rounded-[14px] border border-hairline p-[22px]">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] leading-none font-semibold text-ink">Bookings by source</h2>
        <span className="text-[13px] leading-none text-ink-muted">Last 30 days</span>
      </div>

      {total === 0 ? (
        <p className="mt-4 text-[14px] leading-[1.55] text-ink-secondary">
          Nothing yet. Once your link is out in the world, this shows exactly which channel is
          bringing bookings in.
        </p>
      ) : (
        <div className="mt-[18px] flex flex-col gap-3">
          {sources.map((source, index) => (
            <div key={source.source} className="flex items-center gap-3.5">
              <span className="w-20 flex-none truncate text-[14px] leading-none text-ink-secondary md:w-24">
                {source.label}
              </span>
              <span className="h-[22px] flex-1 overflow-hidden rounded-[4px] bg-field">
                <span
                  className={`block h-[22px] ${BAR_COLOURS[index % BAR_COLOURS.length]}`}
                  style={{ width: `${Math.round((source.count / max) * 100)}%` }}
                />
              </span>
              <span className="w-[34px] flex-none text-right text-[14px] leading-none font-semibold text-ink">
                {source.count}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-[18px] max-w-[560px] text-[13px] leading-[1.5] text-ink-muted">
        Google doesn&rsquo;t report performance for custom booking links. This is your number.
      </p>
    </section>
  )
}
