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

/** Short, unambiguous suffix for a retried slug. No vowels, so it cannot spell anything. */
function randomSuffix(attempt: number): string {
  const alphabet = '23456789bcdfghjkmnpqrstvwxz'
  let out = ''
  for (let i = 0; i < 3 + attempt; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
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

  // `uniqueSlug` reads before it writes, so two signups racing on the same
  // derived slug both see it free and one loses on the unique index. That is
  // not hypothetical: tapping "send it again" and opening both links does it.
  // Retry on the actual violation rather than trying to pre-check harder.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await createAccount({ email, provisionalName, localPart, attempt })
    } catch (error) {
      if (isSlugConflict(error) && attempt < 4) continue

      // Someone else finished creating this account while we were racing them.
      if (isEmailRace(error)) {
        const winner = await db.query.staff.findFirst({
          where: and(eq(s.staff.email, email), eq(s.staff.isActive, true)),
        })
        if (winner) {
          return {
            staffId: winner.id,
            businessId: winner.businessId,
            isNew: false,
            onboardingComplete: false,
          }
        }
      }
      throw error
    }
  }

  throw new Error('Could not allocate a unique booking link')
}

/** Postgres unique_violation. */
function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause
  return cause?.code === '23505' || (error as { code?: string })?.code === '23505'
}

function constraintOf(error: unknown): string | undefined {
  const cause = (error as { cause?: { constraint_name?: string } })?.cause
  return cause?.constraint_name ?? (error as { constraint_name?: string })?.constraint_name
}

function isSlugConflict(error: unknown): boolean {
  return isUniqueViolation(error) && constraintOf(error) === 'business_slug_idx'
}

function isEmailRace(error: unknown): boolean {
  return isUniqueViolation(error) && constraintOf(error) !== 'business_slug_idx'
}

async function createAccount(input: {
  email: string
  provisionalName: string
  localPart: string
  attempt: number
}): Promise<Account> {
  const { email, provisionalName, localPart, attempt } = input

  // Widen the search on each retry so repeated collisions converge quickly
  // rather than fighting over the same next-free value.
  const seed = attempt === 0 ? localPart : `${localPart}-${randomSuffix(attempt)}`
  const slug = await uniqueSlug(seed)

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
