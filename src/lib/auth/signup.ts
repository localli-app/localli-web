import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import * as s from '../db/schema'
import { defaultBookingSettings } from '../db/schema'
import { normaliseEmail } from '../identity/normalise'

/**
 * Turning a verified email into an account.
 *
 * The magic link both creates the account and signs them in. There is no
 * separate "verify your email" step, no password to choose, and no
 * confirmation screen between the link and the wizard.
 */

/** Defaults for a brand-new business. The wizard exists to change these, not to collect them from scratch. */
const DEFAULT_TIMEZONE = 'Europe/London'
const DEFAULT_CURRENCY = 'GBP'

/** Pre-filled Tue-Sat, 9:00-18:00, per planning/12-dashboard-spec.md step 4. */
const DEFAULT_WEEKDAYS = [2, 3, 4, 5, 6]
const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '18:00'

export interface Account {
  staffId: string
  businessId: string
  isNew: boolean
  onboardingComplete: boolean
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    // Strip combining marks so "Fauré" becomes "faure" rather than "faur".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Appends a numeric suffix until the slug is free. */
export async function uniqueSlug(base: string, excludeBusinessId?: string): Promise<string> {
  const seed = slugify(base) || 'salon'

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${attempt + 1}`
    const clash = await db.query.businesses.findFirst({
      where: eq(s.businesses.slug, candidate),
    })
    if (!clash || clash.id === excludeBusinessId) return candidate
  }

  return `${seed}-${Date.now().toString(36)}`
}

/**
 * Finds the account for a verified email, creating one on first sight.
 *
 * A provisional name and slug are derived from the address so the business row
 * is valid immediately; wizard step 1 replaces both. Default opening hours are
 * written now rather than in the wizard, so a business that skips every
 * optional step is still bookable.
 */
export async function resolveOrCreateAccount(rawEmail: string): Promise<Account> {
  const email = normaliseEmail(rawEmail)
  if (!email) throw new Error('An email address is required')

  const existing = await db.query.staff.findFirst({
    where: and(eq(s.staff.email, email), eq(s.staff.isActive, true)),
  })

  if (existing) {
    const business = await db.query.businesses.findFirst({
      where: eq(s.businesses.id, existing.businessId),
    })
    return {
      staffId: existing.id,
      businessId: existing.businessId,
      isNew: false,
      onboardingComplete: Boolean(business?.onboardingCompletedAt),
    }
  }

  // Drop any +tag before deriving a name, or plus-addressing shows up in the
  // business name the owner sees on their first screen.
  const localPart = (email.split('@')[0] ?? 'salon').split('+')[0] || 'salon'
  const provisionalName =
    localPart.replace(/[._-]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()) || 'My business'
  const slug = await uniqueSlug(localPart)

  return db.transaction(async (tx) => {
    const [business] = await tx
      .insert(s.businesses)
      .values({
        slug,
        name: provisionalName,
        email,
        timezone: DEFAULT_TIMEZONE,
        currency: DEFAULT_CURRENCY,
        bookingSettings: defaultBookingSettings(),
      })
      .returning({ id: s.businesses.id })

    const [owner] = await tx
      .insert(s.staff)
      .values({
        businessId: business.id,
        name: provisionalName,
        email,
        role: 'owner',
        isBookable: true,
      })
      .returning({ id: s.staff.id })

    await tx.insert(s.businessHours).values(
      DEFAULT_WEEKDAYS.map((weekday) => ({
        businessId: business.id,
        weekday,
        opensLocal: DEFAULT_OPEN,
        closesLocal: DEFAULT_CLOSE,
      })),
    )

    await tx.insert(s.staffHours).values(
      DEFAULT_WEEKDAYS.map((weekday) => ({
        staffId: owner.id,
        weekday,
        startsLocal: DEFAULT_OPEN,
        endsLocal: DEFAULT_CLOSE,
      })),
    )

    return {
      staffId: owner.id,
      businessId: business.id,
      isNew: true,
      onboardingComplete: false,
    }
  })
}
