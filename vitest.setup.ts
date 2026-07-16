import { config } from 'dotenv'
import { afterAll, beforeAll } from 'vitest'

config({ path: '.env.local' })

beforeAll(async () => {
  // Pre-upload the fixture asset used by view.test.ts.
  // Local Supabase Storage requires an object to exist before signing; upsert
  // makes this idempotent across test runs. resetDb only truncates tables, so
  // the storage fixture persists for the full test session.
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  await getSupabaseAdmin()
    .storage.from(process.env.SUPABASE_STORAGE_BUCKET!)
    .upload('assets/x.png', Buffer.from('fixture'), { contentType: 'image/png', upsert: true })
})

afterAll(async () => {
  // Disconnect the Prisma client to cleanly close the pg connection pool
  const { prisma } = await import('@/lib/prisma')
  await prisma.$disconnect()
})
