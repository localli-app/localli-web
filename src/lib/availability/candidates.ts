import type { Interval } from './intervals'

/** Every slot start, at `granularityMinutes` steps, where `[start, start+totalMinutes]` fits inside a free interval. */
export function generateCandidateStarts(
  freeIntervals: Interval[],
  totalMinutes: number,
  granularityMinutes: number,
): Date[] {
  const starts: Date[] = []
  const totalMs = totalMinutes * 60_000
  const stepMs = granularityMinutes * 60_000

  for (const { start, end } of freeIntervals) {
    // Walk from the free interval's own start, per planning/05-domain-model.md. Working windows are
    // materialised from business/staff open times, which are themselves on the grid, so candidates stay
    // grid-aligned in the common case; a slot freed up mid-grid by a cancellation starts exactly when it's free.
    for (let t = start.getTime(); t + totalMs <= end.getTime(); t += stepMs) {
      starts.push(new Date(t))
    }
  }
  return starts
}
