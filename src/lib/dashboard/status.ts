/**
 * Booking status carries its own colour set, separate from the terracotta
 * accent, so an unconfirmed or a no-show reads at a glance.
 *
 * Colour-code by STATUS, never by service. Service colour is decoration and it
 * steals the signal the owner actually needs.
 */

export type StatusTone = 'confirmed' | 'awaiting' | 'noshow' | 'done'

export interface StatusPresentation {
  label: string
  /** Compact form for a table cell, where the long label would ellipsis. */
  shortLabel: string
  tone: StatusTone
  /** Tailwind text colour class. */
  text: string
  /** Tailwind background class, for the dot and the duration bar. */
  dot: string
  /**
   * Tailwind left-border class for a table row's status rule. Spelled out
   * rather than derived from `dot`, because Tailwind only generates classes it
   * can see literally in the source — a runtime string swap produces nothing.
   */
  borderLeft: string
}

const TONE_CLASSES: Record<StatusTone, Omit<StatusPresentation, 'label' | 'shortLabel' | 'tone'>> = {
  confirmed: {
    text: 'text-status-confirmed',
    dot: 'bg-status-confirmed',
    borderLeft: 'border-l-status-confirmed',
  },
  awaiting: {
    text: 'text-status-awaiting',
    dot: 'bg-status-awaiting',
    borderLeft: 'border-l-status-awaiting',
  },
  noshow: {
    text: 'text-status-noshow',
    dot: 'bg-status-noshow',
    borderLeft: 'border-l-status-noshow',
  },
  done: {
    text: 'text-status-done',
    dot: 'bg-status-done',
    borderLeft: 'border-l-status-done',
  },
}

const BY_STATUS: Record<string, { label: string; shortLabel?: string; tone: StatusTone }> = {
  confirmed: { label: 'Confirmed', tone: 'confirmed' },
  in_progress: { label: 'In progress', tone: 'confirmed' },
  pending_payment: { label: 'Awaiting confirmation', shortLabel: 'Awaiting', tone: 'awaiting' },
  completed: { label: 'Completed', tone: 'done' },
  no_show: { label: 'No-show', tone: 'noshow' },
  cancelled_by_customer: { label: 'Cancelled', tone: 'done' },
  cancelled_by_business: { label: 'Cancelled by you', shortLabel: 'Cancelled', tone: 'done' },
}

export function presentStatus(status: string): StatusPresentation {
  const entry = BY_STATUS[status] ?? { label: status, tone: 'done' as StatusTone }
  return {
    label: entry.label,
    shortLabel: entry.shortLabel ?? entry.label,
    tone: entry.tone,
    ...TONE_CLASSES[entry.tone],
  }
}

/**
 * Height in px for the proportional duration bar beside an agenda row, so a
 * 150-minute colour visibly outweighs a 45-minute blow dry. Floored so a short
 * appointment still meets the row's minimum, capped so a long one cannot run
 * away with the layout.
 */
export function durationBarHeight(minutes: number): number {
  return Math.round(Math.min(120, Math.max(44, 40 + minutes * 0.35)))
}

/** "1h 30m free", "45m free" */
export function formatGapLength(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}
