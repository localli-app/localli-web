import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// `generate` only diffs the schema against migration history and needs no
// live connection, so a placeholder is fine here. `migrate`/`push` do need
// a real DATABASE_URL in the environment.
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder/placeholder',
  },
  strict: true,
  verbose: true,
})
