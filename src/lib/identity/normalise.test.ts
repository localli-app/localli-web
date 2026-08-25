import { describe, expect, it } from 'vitest'
import { normaliseEmail, normalisePhone } from './normalise'

describe('normalisePhone', () => {
  it('converts a GB national number to E.164', () => {
    expect(normalisePhone('07700 900123')).toBe('+447700900123')
    expect(normalisePhone('07700900123')).toBe('+447700900123')
  })

  it('strips punctuation a customer might type', () => {
    expect(normalisePhone('(07700) 900-123')).toBe('+447700900123')
  })

  it('preserves an explicit international number', () => {
    expect(normalisePhone('+33 6 12 34 56 78')).toBe('+33612345678')
  })

  it('handles the 00 international prefix', () => {
    expect(normalisePhone('0044 7700 900123')).toBe('+447700900123')
  })

  it('accepts a country code typed without the plus', () => {
    expect(normalisePhone('447700900123')).toBe('+447700900123')
  })

  it('rejects input too short to be a number', () => {
    expect(normalisePhone('12345')).toBeNull()
    expect(normalisePhone('   ')).toBeNull()
  })

  it('is idempotent — normalising twice changes nothing', () => {
    const once = normalisePhone('07700 900123')!
    expect(normalisePhone(once)).toBe(once)
  })
})

describe('normaliseEmail', () => {
  it('lowercases and trims', () => {
    expect(normaliseEmail('  Priya@Example.COM ')).toBe('priya@example.com')
  })

  it('does NOT strip gmail dots or plus-addressing, which are distinct addresses', () => {
    expect(normaliseEmail('pri.ya+salon@gmail.com')).toBe('pri.ya+salon@gmail.com')
  })

  it('returns null for empty input', () => {
    expect(normaliseEmail('   ')).toBeNull()
  })
})
