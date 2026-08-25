import 'dotenv/config'
import { purgeExpiredAuthRows } from '../src/lib/auth/staff-session'

/**
 * Deletes spent login tokens and long-dead sessions.
 *
 * Run on a schedule (Inngest cron, or `npm run db:purge-auth` from cron) once
 * this is deployed. Both tables previously only ever grew.
 */
const result = await purgeExpiredAuthRows()
console.log(`Purged ${result.tokens} login token(s) and ${result.sessions} session(s).`)
process.exit(0)
