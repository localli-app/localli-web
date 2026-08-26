import { afterEach, describe, expect, it } from 'vitest'
import { clientIp, safeInternalPath } from './request-context'

describe('safeInternalPath', () => {
  it('accepts ordinary internal paths', () => {
    expect(safeInternalPath('/app')).toBe('/app')
    expect(safeInternalPath('/app/bookings?tab=past')).toBe('/app/bookings?tab=past')
    expect(safeInternalPath('/app#section')).toBe('/app#section')
  })

  it('rejects absolute URLs', () => {
    expect(safeInternalPath('https://evil.com')).toBeNull()
    expect(safeInternalPath('http://evil.com/app')).toBeNull()
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeInternalPath('//evil.com')).toBeNull()
  })

  it('rejects the backslash form that the naive check lets through', () => {
    // The bug this function exists for: browsers read \ as / in the authority,
    // so these resolve off-origin despite starting with a single slash.
    expect(safeInternalPath('/\\evil.com')).toBeNull()
    expect(safeInternalPath('/\\/evil.com')).toBeNull()
    expect(safeInternalPath('/\\\\evil.com')).toBeNull()
  })

  it('rejects paths carrying control characters or whitespace', () => {
    expect(safeInternalPath('/\tevil')).toBeNull()
    expect(safeInternalPath('/\nevil')).toBeNull()
    expect(safeInternalPath('/ evil')).toBeNull()
    expect(safeInternalPath('/\r\n/evil.com')).toBeNull()
  })

  it('rejects anything not starting with a slash', () => {
    expect(safeInternalPath('app')).toBeNull()
    expect(safeInternalPath('javascript:alert(1)')).toBeNull()
    expect(safeInternalPath('')).toBeNull()
    expect(safeInternalPath(null)).toBeNull()
    expect(safeInternalPath(undefined)).toBeNull()
  })

  it('resolves traversal down to a still-internal path', () => {
    // Not dangerous — it cannot leave the origin — so normalising is enough.
    expect(safeInternalPath('/app/../admin')).toBe('/admin')
  })
})

describe('clientIp', () => {
  const originalHops = process.env.TRUSTED_PROXY_HOP_COUNT

  afterEach(() => {
    if (originalHops === undefined) delete process.env.TRUSTED_PROXY_HOP_COUNT
    else process.env.TRUSTED_PROXY_HOP_COUNT = originalHops
  })

  it('ignores x-forwarded-for entirely when no proxy is trusted', () => {
    delete process.env.TRUSTED_PROXY_HOP_COUNT
    const headers = new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })
    expect(clientIp(headers)).toBeNull()
  })

  it('takes the hop the trusted proxy appended, not the leftmost value', () => {
    process.env.TRUSTED_PROXY_HOP_COUNT = '1'
    // A client forging the header prepends entries; only the rightmost was
    // written by our own proxy.
    const headers = new Headers({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 203.0.113.5' })
    expect(clientIp(headers)).toBe('203.0.113.5')
  })

  it('cannot be walked past by rotating forged leftmost entries', () => {
    process.env.TRUSTED_PROXY_HOP_COUNT = '1'
    const real = '203.0.113.5'
    const seen = new Set(
      ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((forged) =>
        clientIp(new Headers({ 'x-forwarded-for': `${forged}, ${real}` })),
      ),
    )
    // Every attempt buckets to the same IP, so the per-IP limit still bites.
    expect([...seen]).toEqual([real])
  })

  it('handles two trusted hops', () => {
    process.env.TRUSTED_PROXY_HOP_COUNT = '2'
    const headers = new Headers({ 'x-forwarded-for': '9.9.9.9, 203.0.113.5, 10.0.0.1' })
    expect(clientIp(headers)).toBe('203.0.113.5')
  })

  it('falls back to x-real-ip when the chain is absent', () => {
    process.env.TRUSTED_PROXY_HOP_COUNT = '1'
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('normalises IPv4-mapped IPv6 so it buckets with the plain form', () => {
    process.env.TRUSTED_PROXY_HOP_COUNT = '1'
    expect(clientIp(new Headers({ 'x-forwarded-for': '::ffff:203.0.113.5' }))).toBe('203.0.113.5')
  })

  it('returns null when there is nothing to go on', () => {
    process.env.TRUSTED_PROXY_HOP_COUNT = '1'
    expect(clientIp(new Headers())).toBeNull()
  })
})
