import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  formatLocalTimeLabel,
  formatMoney,
  formatPhoneForDisplay,
  formatTime,
  relativeDayLabel,
  summariseWeeklyHours,
} from './format'

describe('formatMoney', () => {
  it('renders a whole-pound price without decimals, as the design does', () => {
    expect(formatMoney(4500, 'GBP')).toBe('£45')
    expect(formatMoney(12000, 'GBP')).toBe('£120')
  })

  it('keeps decimals when the amount is not a whole unit', () => {
    expect(formatMoney(4550, 'GBP')).toBe('£45.50')
  })
})

describe('formatDuration', () => {
  it('uses bare minutes throughout, as the service list artboard does', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(75)).toBe('75 min')
    expect(formatDuration(150)).toBe('150 min')
  })
})

describe('formatTime', () => {
  it('renders in the business timezone, not the server timezone', () => {
    // 13:15 UTC in August is 14:15 BST in London.
    expect(formatTime(new Date('2026-08-27T13:15:00Z'), 'Europe/London')).toBe('2:15pm')
    expect(formatTime(new Date('2026-08-27T13:15:00Z'), 'America/New_York')).toBe('9:15am')
  })
})

describe('relativeDayLabel', () => {
  const tz = 'Europe/London'
  const now = new Date('2026-08-25T09:00:00Z') // Tuesday

  it('says Today and Tomorrow for the near days', () => {
    expect(relativeDayLabel(new Date('2026-08-25T14:30:00Z'), tz, now)).toBe('Today')
    expect(relativeDayLabel(new Date('2026-08-26T09:00:00Z'), tz, now)).toBe('Tomorrow')
  })

  it('uses a weekday name within the coming week', () => {
    expect(relativeDayLabel(new Date('2026-08-27T13:15:00Z'), tz, now)).toBe('Thursday')
  })

  it('falls back to a date further out', () => {
    expect(relativeDayLabel(new Date('2026-09-15T13:15:00Z'), tz, now)).toBe('Tue 15 Sep')
  })
})

describe('formatLocalTimeLabel', () => {
  it('drops :00 and uses a 12-hour clock', () => {
    expect(formatLocalTimeLabel('09:00')).toBe('9am')
    expect(formatLocalTimeLabel('19:00')).toBe('7pm')
    expect(formatLocalTimeLabel('12:00')).toBe('12pm')
    expect(formatLocalTimeLabel('00:00')).toBe('12am')
    expect(formatLocalTimeLabel('17:30')).toBe('5:30pm')
  })
})

describe('summariseWeeklyHours', () => {
  it('collapses a consecutive run and names the closed days, as the landing shows', () => {
    const hours = [2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opensLocal: '09:00',
      closesLocal: '19:00',
    }))
    expect(summariseWeeklyHours(hours)).toBe('Tue–Sat, 9am–7pm · Closed Sun & Mon')
  })

  it('splits a run when one day has different hours', () => {
    const hours = [
      { weekday: 1, opensLocal: '09:00', closesLocal: '17:00' },
      { weekday: 2, opensLocal: '09:00', closesLocal: '17:00' },
      { weekday: 3, opensLocal: '10:00', closesLocal: '20:00' },
    ]
    expect(summariseWeeklyHours(hours)).toBe(
      'Mon–Tue, 9am–5pm · Wed, 10am–8pm · Closed Sun, Thu, Fri & Sat',
    )
  })

  it('omits the closed clause when the business opens every day', () => {
    const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opensLocal: '09:00',
      closesLocal: '17:00',
    }))
    expect(summariseWeeklyHours(hours)).toBe('Mon–Sun, 9am–5pm')
  })

  it('returns an empty string when no hours are set', () => {
    expect(summariseWeeklyHours([])).toBe('')
  })
})

describe('formatPhoneForDisplay', () => {
  it('renders a London landline the way the design shows it', () => {
    expect(formatPhoneForDisplay('+442079460100')).toBe('020 7946 0100')
  })

  it('renders a GB mobile in the familiar grouping', () => {
    expect(formatPhoneForDisplay('+447700900123')).toBe('07700 900123')
  })

  it('passes a non-GB number through rather than guessing its format', () => {
    expect(formatPhoneForDisplay('+33612345678')).toBe('+33612345678')
  })
})
