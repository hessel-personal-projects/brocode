import { getSupabaseAdmin } from './supabase'

function bucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET!
}

export async function uploadAsset(
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .storage.from(bucket())
    .upload(objectKey, body, { contentType, upsert: false })
  if (error) throw new Error(`upload failed: ${error.message}`)
}

export async function createSignedUrl(
  objectKey: string,
  expiresInSeconds: number,
): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(bucket())
    .createSignedUrl(objectKey, expiresInSeconds)
  if (error || !data) throw new Error(`sign failed: ${error?.message ?? 'no data'}`)
  return data.signedUrl
}

export async function removeAsset(objectKey: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .storage.from(bucket())
    .remove([objectKey])
  if (error) throw new Error(`remove failed: ${error.message}`)
}
