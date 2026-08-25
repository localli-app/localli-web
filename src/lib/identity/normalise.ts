/**
 * Contact-detail normalisation, applied at write time.
 *
 * SCOPE LIMIT: this is a deliberately narrow GB-first E.164 normaliser, not a
 * general one. It covers +44/0044/07… and passes through anything already in
 * +<digits> form. Before Localli takes bookings outside the UK this should be
 * replaced with libphonenumber-js — a hand-rolled parser silently produces
 * duplicate customers, which is the exact failure planning/05-domain-model.md
 * warns about. Kept dependency-free for now because the demo is single-country.
 */

const DEFAULT_COUNTRY_CODE = '44'

export function normalisePhone(raw: string, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 6) return null

  if (hadPlus) return `+${digits}`

  // 0044... international prefix
  if (digits.startsWith('00')) return `+${digits.slice(2)}`

  // National trunk form: 07700 900123 -> +447700900123
  if (digits.startsWith('0')) return `+${countryCode}${digits.slice(1)}`

  // Already carries the country code without a plus, e.g. 447700900123
  if (digits.startsWith(countryCode)) return `+${digits}`

  return `+${countryCode}${digits}`
}

/**
 * Lowercase and trim only. Gmail dots and plus-addressing are NOT stripped:
 * they are legitimately different addresses to some providers and some people,
 * and collapsing them would merge distinct customers.
 */
export function normaliseEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase()
  return value.length > 0 ? value : null
}
