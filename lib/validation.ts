import { randomUUID } from 'node:crypto'
import { z } from 'zod'

export const MAX_FILE_BYTES = 5 * 1024 * 1024

export type AssetKind = 'image' | 'video'

const CONTENT_TYPES: Record<string, { kind: AssetKind; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/gif': { kind: 'image', ext: 'gif' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/webm': { kind: 'video', ext: 'webm' },
}

export function assetInfoFor(contentType: string): { kind: AssetKind; ext: string } | null {
  return CONTENT_TYPES[contentType] ?? null
}

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'name required'),
  email: z.email('invalid email'),
})

export const createSchema = z.object({
  creatorName: z.string().trim().min(1, 'creator name required'),
  creatorEmail: z.email('invalid creator email'),
  title: z.string().trim().max(200).optional(),
  contacts: z.array(contactSchema).min(1, 'at least 1 contact').max(10, 'at most 10 contacts'),
})

export type CreateFields = z.infer<typeof createSchema>

export function objectKeyFor(ext: string): string {
  return `assets/${randomUUID()}.${ext}`
}
