/**
 * Types for the pure availability engine. No I/O, no imports from db or fetch.
 * Everything the engine needs is passed in as an already-loaded snapshot.
 */

/** "HH:mm", 24-hour, local wall-clock. */
export type LocalTime = string

/** "YYYY-MM-DD", a business-local calendar date. */
export type LocalDate = string

export interface WeeklyHours {
  /** 0 = Sunday .. 6 = Saturday */
  weekday: number
  opensLocal: LocalTime
  closesLocal: LocalTime
}

/** Staff hours additionally support a validity window, e.g. a seasonal schedule change. */
export interface StaffWeeklyHours extends WeeklyHours {
  effectiveFrom?: LocalDate
  effectiveTo?: LocalDate
}

export interface LatLng {
  lat: number
  lng: number
}

export interface StaffInput {
  id: string
  hours: StaffWeeklyHours[]
  /** Mobile only: where this staff member's day starts and ends. */
  baseLocation?: LatLng
}

export interface BookingInput {
  staffId: string
  startsAt: Date
  endsAt: Date
  /** Mobile only: where this booking is serviced. */
  location?: LatLng
  /** Mobile only: travel already attributed to this booking, for the daily drive-time budget. */
  travelInMinutes?: number
  travelOutMinutes?: number
}

export interface BlackoutInput {
  /** null = whole business is closed for this period. */
  staffId: string | null
  startsAt: Date
  endsAt: Date
}

export interface ServiceInput {
  durationMinutes: number
  bufferAfterMinutes: number
  /** Mobile only: kit setup before, pack-down after. Occupies the calendar. */
  setupMinutes?: number
  packdownMinutes?: number
}

export type AssignmentRule = 'least_utilised' | 'round_robin' | 'first_available'

export interface BookingSettingsInput {
  slotGranularityMinutes: number
  minNoticeMinutes: number
  maxAdvanceDays: number
  assignmentRule: AssignmentRule
}

export interface ServiceAreaInput {
  /** null = applies to the whole business. */
  staffId: string | null
  centre: LatLng
  radiusMetres: number
}

export interface TravelPolicyInput {
  maxLegMinutes: number
  maxDailyDriveMinutes: number
}

/** Injected so the engine stays pure. Swap in a routing-matrix client later without touching this module. */
export type TravelEstimator = (origin: LatLng, dest: LatLng, at: Date) => number

export interface MobileInput {
  destination: LatLng
  serviceAreas: ServiceAreaInput[]
  travelPolicy: TravelPolicyInput
  estimate: TravelEstimator
}

export interface Slot {
  startsAt: Date
  endsAt: Date
  staffId: string
  /** Mobile only. */
  travelInMinutes?: number
  travelOutMinutes?: number
}

export interface DaySlots {
  date: LocalDate
  slots: Slot[]
}

export interface ComputeAvailabilityInput {
  timezone: string
  /** Injected explicitly rather than read from the clock, so results are deterministic and testable. */
  now: Date
  businessHours: WeeklyHours[]
  staff: StaffInput[]
  bookings: BookingInput[]
  blackouts: BlackoutInput[]
  service: ServiceInput
  from: LocalDate
  to: LocalDate
  settings: BookingSettingsInput
  /** Omit for "Anyone". */
  staffId?: string | null
  mobile?: MobileInput
}

export interface ComputeAvailabilityResult {
  days: DaySlots[]
  /** True when a mobile destination falls outside every service area. `days` is empty in that case. */
  outOfArea?: boolean
}
