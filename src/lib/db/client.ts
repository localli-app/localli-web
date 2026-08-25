import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
}

/**
 * Next's dev server re-evaluates modules on every hot reload. Without caching,
 * each reload opens a fresh pool and the old one is never closed, which
 * exhausts Supabase's pooler (15 clients in session mode) within a few edits.
 * Cache on globalThis so reloads reuse one pool.
 */
const globalForDb = globalThis as unknown as {
  __localliSql?: ReturnType<typeof postgres>
}

const queryClient =
  globalForDb.__localliSql ??
  postgres(process.env.DATABASE_URL, {
    // `prepare: false` is required behind Supabase's transaction pooler and is
    // harmless on a session pooler or direct connection.
    prepare: false,
    // Stay well under the pooler's client cap, leaving headroom for migrations,
    // seeds and scripts running alongside the app.
    max: 5,
    idle_timeout: 20,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__localliSql = queryClient
}

export const db = drizzle(queryClient, { schema })
