/** Skeleton rows from artboard 1e, so the table's shape is stable before data lands. */
export default function BookingsLoading() {
  return (
    <div className="flex-1">
      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[88px_74px_1.25fr_1.3fr_78px_128px_76px] gap-3 border-b border-hairline py-[11px] pr-5 pl-7 text-[12px] leading-none font-semibold tracking-[0.05em] text-ink-muted">
            <span>DATE</span>
            <span>TIME</span>
            <span>CUSTOMER</span>
            <span>SERVICE</span>
            <span>STAFF</span>
            <span>STATUS</span>
            <span className="text-right">VALUE</span>
          </div>
          {[0, 1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="grid grid-cols-[88px_74px_1.25fr_1.3fr_78px_128px_76px] items-center gap-3 border-b border-hairline-soft py-[15px] pr-5 pl-7"
            >
              <span className="h-[11px] rounded-[5px] bg-canvas" />
              <span className="h-[11px] rounded-[5px] bg-canvas" />
              <span className="h-[11px] w-[78%] rounded-[5px] bg-[#E7DFD4]" />
              <span className="h-[11px] w-[86%] rounded-[5px] bg-canvas" />
              <span className="h-[11px] rounded-[5px] bg-canvas" />
              <span className="h-[11px] w-[70%] rounded-[5px] bg-canvas" />
              <span className="h-[11px] rounded-[5px] bg-canvas" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-[18px] md:hidden">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex flex-col gap-2.5 rounded-xl border border-hairline p-3.5">
            <span className="h-[11px] w-[60%] rounded-[5px] bg-[#E7DFD4]" />
            <span className="h-[11px] w-[80%] rounded-[5px] bg-canvas" />
            <span className="h-[11px] w-[45%] rounded-[5px] bg-canvas" />
          </div>
        ))}
      </div>

      <p className="px-7 pt-3.5 pb-[18px] text-[13px] leading-none text-ink-muted">
        Loading bookings…
      </p>
    </div>
  )
}
