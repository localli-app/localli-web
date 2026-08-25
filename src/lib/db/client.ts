import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
}

const queryClient = postgres(process.env.DATABASE_URL, { prepare: false })

export const db = drizzle(queryClient, { schema })
