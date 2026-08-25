import { and, eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import * as s from '../db/schema'
import { normaliseEmail, normalisePhone } from './normalise'

/**
 * Customer identity resolution, per the ladder in planning/05-domain-model.md.
 *
 *   1. Signed link token   (definitive)          — not yet issued, see note below
 *   2. Device token        (high confidence)
 *   3. Exact email match
 *   4. Exact normalised phone match
 *   5. Create
 *
 * Two rules prevent the worst failures, and both are enforced here:
 *   - NEVER merge on a partial match. Name similarity is not evidence.
 *   - NEVER overwrite an existing contact detail from a guest booking. Add a
 *     new customer_identity row so a customer accumulates identities instead
 *     of losing them.
 */

// Drizzle's transaction type is awkward to name precisely; this is the shape we use.
type Tx = PgTransaction<never, typeof s, never> | typeof import('../db/client').db

export interface ResolveCustomerInput {
  tx: Tx
  businessId: string
  firstName: string
  lastName?: string | null
  phone?: string | null
  email?: string | null
  deviceToken?: string | null
}

export interface ResolvedCustomer {
  customerId: string
  isNew: boolean
  matchedBy: 'device_token' | 'email' | 'phone' | 'created'
}

export async function resolveCustomer(input: ResolveCustomerInput): Promise<ResolvedCustomer> {
  const { tx, businessId, firstName, lastName, deviceToken } = input
  const phone = input.phone ? normalisePhone(input.phone) : null
  const email = input.email ? normaliseEmail(input.email) : null

  // Step 2: device token. High confidence, but a shared phone is common — a
  // mother booking for her daughter must not merge two people. If the contact
  // details typed differ from those on file, this is a DIFFERENT customer.
  if (deviceToken) {
    const identity = await tx.query.customerIdentities.findFirst({
      where: and(
        eq(s.customerIdentities.kind, 'device_token'),
        eq(s.customerIdentities.value, deviceToken),
      ),
    })
    if (identity) {
      const existing = await tx.query.customers.findFirst({
        where: eq(s.customers.id, identity.customerId),
      })
      if (existing) {
        const contactConflicts =
          (phone && existing.phone && existing.phone !== phone) ||
          (email && existing.email && existing.email !== email)

        if (!contactConflicts) {
          await addMissingIdentities(tx, existing, { phone, email })
          return { customerId: existing.id, isNew: false, matchedBy: 'device_token' }
        }
        // Fall through to contact matching, then creation. Deliberately does
        // not reuse or rewrite the device-token owner's record.
      }
    }
  }

  // Step 3: exact email.
  if (email) {
    const byEmail = await tx.query.customers.findFirst({ where: eq(s.customers.email, email) })
    if (byEmail) {
      await addMissingIdentities(tx, byEmail, { phone, email })
      await linkDeviceToken(tx, byEmail.id, deviceToken)
      return { customerId: byEmail.id, isNew: false, matchedBy: 'email' }
    }
  }

  // Step 4: exact phone, after E.164 normalisation.
  if (phone) {
    const byPhone = await tx.query.customers.findFirst({ where: eq(s.customers.phone, phone) })
    if (byPhone) {
      await addMissingIdentities(tx, byPhone, { phone, email })
      await linkDeviceToken(tx, byPhone.id, deviceToken)
      return { customerId: byPhone.id, isNew: false, matchedBy: 'phone' }
    }
  }

  // Step 5: create. `customer` is global, never a child of a business —
  // firstSeenBusinessId records where we met them, nothing more.
  const [createdRow] = await tx
    .insert(s.customers)
    .values({
      firstName,
      lastName: lastName ?? null,
      phone,
      email,
      firstSeenBusinessId: businessId,
    })
    .returning({ id: s.customers.id })

  const identityRows = [
    ...(email
      ? [{ customerId: createdRow.id, kind: 'email' as const, value: email, confidence: 60 }]
      : []),
    ...(phone
      ? [{ customerId: createdRow.id, kind: 'phone' as const, value: phone, confidence: 60 }]
      : []),
    ...(deviceToken
      ? [
          {
            customerId: createdRow.id,
            kind: 'device_token' as const,
            value: deviceToken,
            confidence: 30,
          },
        ]
      : []),
  ]
  if (identityRows.length > 0) {
    await tx.insert(s.customerIdentities).values(identityRows).onConflictDoNothing()
  }

  return { customerId: createdRow.id, isNew: true, matchedBy: 'created' }
}

/**
 * Adds contact details the customer did not already have, as new identity rows.
 * Never overwrites an existing value — that is how details get lost.
 */
async function addMissingIdentities(
  tx: Tx,
  existing: { id: string; phone: string | null; email: string | null },
  incoming: { phone: string | null; email: string | null },
) {
  const rows: { customerId: string; kind: 'email' | 'phone'; value: string; confidence: number }[] =
    []

  if (incoming.email && incoming.email !== existing.email) {
    rows.push({ customerId: existing.id, kind: 'email', value: incoming.email, confidence: 60 })
  }
  if (incoming.phone && incoming.phone !== existing.phone) {
    rows.push({ customerId: existing.id, kind: 'phone', value: incoming.phone, confidence: 60 })
  }
  if (rows.length > 0) {
    await tx.insert(s.customerIdentities).values(rows).onConflictDoNothing()
  }

  // Filling a genuinely EMPTY column is not an overwrite, so it is allowed and
  // is how a phone-only customer gains an email over time.
  const fill: Partial<{ phone: string; email: string }> = {}
  if (!existing.phone && incoming.phone) fill.phone = incoming.phone
  if (!existing.email && incoming.email) fill.email = incoming.email
  if (Object.keys(fill).length > 0) {
    await tx.update(s.customers).set(fill).where(eq(s.customers.id, existing.id))
  }
}

async function linkDeviceToken(tx: Tx, customerId: string, deviceToken?: string | null) {
  if (!deviceToken) return
  await tx
    .insert(s.customerIdentities)
    .values({ customerId, kind: 'device_token', value: deviceToken, confidence: 30 })
    .onConflictDoNothing()
}
