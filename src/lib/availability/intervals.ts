export interface Interval {
  start: Date
  end: Date
}

/** All pairwise overlaps between two interval lists. Neither input needs to be sorted or disjoint. */
export function intersectIntervalLists(a: Interval[], b: Interval[]): Interval[] {
  const result: Interval[] = []
  for (const ia of a) {
    for (const ib of b) {
      const start = ia.start > ib.start ? ia.start : ib.start
      const end = ia.end < ib.end ? ia.end : ib.end
      if (start < end) result.push({ start, end })
    }
  }
  return result
}

/** `base` with every interval in `cut` removed, splitting entries where necessary. */
export function subtractIntervalLists(base: Interval[], cut: Interval[]): Interval[] {
  let result = base.slice()
  for (const s of cut) {
    const next: Interval[] = []
    for (const b of result) {
      if (s.end <= b.start || s.start >= b.end) {
        next.push(b)
        continue
      }
      if (s.start > b.start) next.push({ start: b.start, end: s.start })
      if (s.end < b.end) next.push({ start: s.end, end: b.end })
    }
    result = next
  }
  return result.filter((iv) => iv.start < iv.end)
}

/** Clip every interval to lie within [lower, upper], dropping any that end up empty. */
export function clipIntervals(intervals: Interval[], lower: Date, upper: Date): Interval[] {
  const result: Interval[] = []
  for (const iv of intervals) {
    const start = iv.start > lower ? iv.start : lower
    const end = iv.end < upper ? iv.end : upper
    if (start < end) result.push({ start, end })
  }
  return result
}
