import { describe, expect, it } from 'vitest'
import { enumerateLocalDates, hoursToInterval, weekdayOf } from './windows'

describe('weekdayOf', () => {
  it('returns the correct ISO weekday index independent of runtime timezone', () => {
    // 2026-08-25 is a Tuesday
    expect(weekdayOf('2026-08-25')).toBe(2)
    // 2026-08-23 is a Sunday
    expect(weekdayOf('2026-08-23')).toBe(0)
  })
})

describe('enumerateLocalDates', () => {
  it('is inclusive of both endpoints', () => {
    expect(enumerateLocalDates('2026-08-25', '2026-08-27')).toEqual([
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
    ])
  })

  it('returns a single date when from equals to', () => {
    expect(enumerateLocalDates('2026-08-25', '2026-08-25')).toEqual(['2026-08-25'])
  })
})

describe('hoursToInterval — daylight saving correctness (permanent fixtures)', () => {
  const tz = 'Europe/London'

  it('a normal day: 00:00-05:00 is a genuine 300 minutes', () => {
    const { start, end } = hoursToInterval('2026-03-22', { weekday: 0, opensLocal: '00:00', closesLocal: '05:00' }, tz)
    expect((end.getTime() - start.getTime()) / 60_000).toBe(300)
  })

  it('spring-forward Sunday (2026-03-29, GMT->BST): 00:00-05:00 is only 240 real minutes, the clock skips an hour', () => {
    const { start, end } = hoursToInterval('2026-03-29', { weekday: 0, opensLocal: '00:00', closesLocal: '05:00' }, tz)
    expect((end.getTime() - start.getTime()) / 60_000).toBe(240)
  })

  it('fall-back Sunday (2026-10-25, BST->GMT): 00:00-05:00 is 360 real minutes, the clock repeats an hour', () => {
    const { start, end } = hoursToInterval('2026-10-25', { weekday: 0, opensLocal: '00:00', closesLocal: '05:00' }, tz)
    expect((end.getTime() - start.getTime()) / 60_000).toBe(360)
  })

  it('a "9am to 5pm" business day is unaffected when the transition happens outside those hours', () => {
    const spring = hoursToInterval('2026-03-29', { weekday: 0, opensLocal: '09:00', closesLocal: '17:00' }, tz)
    const fallBack = hoursToInterval('2026-10-25', { weekday: 0, opensLocal: '09:00', closesLocal: '17:00' }, tz)
    expect((spring.end.getTime() - spring.start.getTime()) / 60_000).toBe(480)
    expect((fallBack.end.getTime() - fallBack.start.getTime()) / 60_000).toBe(480)
  })
})

describe('hoursToInterval — midnight-spanning windows', () => {
  const tz = 'Europe/London'

  it('a close time at or before the open time spans into the next calendar date', () => {
    const { start, end } = hoursToInterval('2026-08-25', { weekday: 2, opensLocal: '20:00', closesLocal: '02:00' }, tz)
    expect((end.getTime() - start.getTime()) / 60_000).toBe(360) // 20:00 -> 02:00 next day = 6 hours
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })

  it('an exact midnight close (00:00) is treated as the next day, not a zero-length window', () => {
    const { start, end } = hoursToInterval('2026-08-25', { weekday: 2, opensLocal: '20:00', closesLocal: '00:00' }, tz)
    expect((end.getTime() - start.getTime()) / 60_000).toBe(240)
  })
})
