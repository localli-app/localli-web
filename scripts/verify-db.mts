import 'dotenv/config'
import postgres from 'postgres'

/**
 * Proves the database guarantees the application relies on, by exercising them
 * against real rows rather than trusting that a migration reported success.
 *
 * Everything runs inside a transaction that is always rolled back, so this is
 * safe to run against a seeded or demo database.
 *
 * Run with: npm run db:verify
 */

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} })

const results: { name: string; ok: boolean; detail: string }[] = []
function record(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

type Sql = postgres.TransactionSql

/**
 * Runs `fn` inside a SAVEPOINT so an expected failure rolls back only that
 * statement. Without this, the first error aborts the whole transaction and
 * every later check fails with 25P02 rather than being genuinely tested.
 */
async function attempt(tx: Sql, fn: (sp: Sql) => Promise<unknown>) {
  try {
    await tx.savepoint(async (sp) => {
      await fn(sp as Sql)
    })
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, code: (e as { code?: string }).code, error: e as Error }
  }
}

async function expectRejected(tx: Sql, name: string, expected: string, fn: (sp: Sql) => Promise<unknown>) {
  const r = await attempt(tx, fn)
  if (r.ok) record(name, false, `expected SQLSTATE ${expected}, but the statement succeeded`)
  else record(name, r.code === expected, r.code === expected ? `rejected with ${r.code}` : `got ${r.code}`)
}

async function expectAccepted(tx: Sql, name: string, fn: (sp: Sql) => Promise<unknown>) {
  const r = await attempt(tx, fn)
  record(name, r.ok, r.ok ? '' : `unexpectedly rejected with ${r.code}`)
}

class Rollback extends Error {}

try {
  console.log('\nExtensions')
  const exts = await sql<{ extname: string; extversion: string }[]>`
    select extname, extversion from pg_extension where extname in ('postgis', 'btree_gist')
  `
  const byName = new Map(exts.map((e) => [e.extname, e.extversion]))
  record('postgis installed', byName.has('postgis'), byName.get('postgis') ?? 'missing')
  record('btree_gist installed', byName.has('btree_gist'), byName.get('btree_gist') ?? 'missing')

  console.log('\nConstraint definitions')
  const [excl] = await sql<{ def: string }[]>`
    select pg_get_constraintdef(oid) as def
    from pg_constraint
    where conname = 'booking_no_overlap' and contype = 'x'
  `
  record('booking_no_overlap exists and is an EXCLUDE constraint', Boolean(excl))
  if (excl) {
    const d = excl.def
    record('  ...keyed on staff_id', d.includes('staff_id WITH ='), '')
    record('  ...overlapping tstzrange', d.includes('&&'), '')
    record(
      '  ...partial to occupying statuses only',
      d.includes('confirmed') && d.includes('in_progress'),
      '',
    )
  }

  const [check] = await sql<{ def: string }[]>`
    select pg_get_constraintdef(oid) as def
    from pg_constraint where conname = 'booking_valid_range' and contype = 'c'
  `
  record('booking_valid_range CHECK exists', Boolean(check))

  console.log('\nBehaviour under real inserts (all rolled back)')
  await sql
    .begin(async (tx) => {
      const [biz] = await tx<{ id: string }[]>`
        insert into business (slug, name, timezone, currency, email)
        values ('verify-tmp', 'Verify Salon', 'Europe/London', 'GBP', 'verify@example.test')
        returning id
      `
      const [sam] = await tx<{ id: string }[]>`
        insert into staff (business_id, name) values (${biz.id}, 'Sam') returning id
      `
      const [alex] = await tx<{ id: string }[]>`
        insert into staff (business_id, name) values (${biz.id}, 'Alex') returning id
      `
      const [svc] = await tx<{ id: string }[]>`
        insert into service (business_id, name, duration_minutes, price_minor)
        values (${biz.id}, 'Cut', 60, 4500) returning id
      `
      const [cust] = await tx<{ id: string }[]>`
        insert into customer (first_name) values ('Priya') returning id
      `

      const policy = { cancellationWindowHours: 24, depositPercent: 0, noShowFeeMinor: 0, text: null }
      let tokenCounter = 0
      const insertBooking =
        (staffId: string, startsAt: string, endsAt: string, status = 'confirmed') =>
        (sp: Sql) => sp`
          insert into booking (
            business_id, staff_id, service_id, customer_id, starts_at, ends_at,
            status, price_minor, currency, policy_snapshot, access_token_hash
          ) values (
            ${biz.id}, ${staffId}, ${svc.id}, ${cust.id}, ${startsAt}, ${endsAt},
            ${status}::booking_status, 4500, 'GBP', ${sp.json(policy)}, ${'tok-' + tokenCounter++}
          )
        `

      // Baseline: a normal booking must be accepted.
      await expectAccepted(
        tx,
        'a first confirmed booking inserts cleanly',
        insertBooking(sam.id, '2026-08-25T10:00:00Z', '2026-08-25T11:00:00Z'),
      )

      // THE test: an overlapping booking for the same staff must be rejected by the database.
      await expectRejected(
        tx,
        'an OVERLAPPING booking for the same staff is rejected (23P01)',
        '23P01',
        insertBooking(sam.id, '2026-08-25T10:30:00Z', '2026-08-25T11:30:00Z'),
      )

      // Guard against a constraint so broad it rejects legitimate bookings.
      await expectAccepted(
        tx,
        'a back-to-back booking (starts exactly at the previous end) is allowed',
        insertBooking(sam.id, '2026-08-25T11:00:00Z', '2026-08-25T12:00:00Z'),
      )
      await expectAccepted(
        tx,
        'the same overlapping time for a DIFFERENT staff member is allowed',
        insertBooking(alex.id, '2026-08-25T10:30:00Z', '2026-08-25T11:30:00Z'),
      )

      // The partial WHERE clause: cancelled bookings must free the slot.
      await expectAccepted(
        tx,
        'a CANCELLED booking may overlap (partial constraint frees the slot)',
        insertBooking(sam.id, '2026-08-25T10:15:00Z', '2026-08-25T10:45:00Z', 'cancelled_by_customer'),
      )

      await expectRejected(
        tx,
        'a booking ending before it starts is rejected (23514)',
        '23514',
        insertBooking(alex.id, '2026-08-25T15:00:00Z', '2026-08-25T14:00:00Z'),
      )

      throw new Rollback()
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e
    })

  console.log('\nAll test rows rolled back.')

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)
  if (failed.length > 0) {
    console.error('FAILED:\n' + failed.map((f) => `  - ${f.name}: ${f.detail}`).join('\n'))
    process.exitCode = 1
  }
} catch (e) {
  console.error('\nVerification aborted:', (e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
