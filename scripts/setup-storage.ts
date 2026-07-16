import { config } from 'dotenv'
config({ path: '.env.local' })

import { getSupabaseAdmin } from '../lib/supabase'

async function main() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!
  const supabase = getSupabaseAdmin()

  const { data: existing } = await supabase.storage.getBucket(bucket)
  if (existing) {
    console.log(`Bucket "${bucket}" already exists`)
    return
  }

  const { error } = await supabase.storage.createBucket(bucket, { public: false })
  if (error) throw error
  console.log(`Created private bucket "${bucket}"`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
