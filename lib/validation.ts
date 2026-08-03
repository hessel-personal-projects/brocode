import { randomUUID } from 'node:crypto'

export const MAX_FILE_BYTES = 5 * 1024 * 1024

export type AssetKind = 'image' | 'video'

const CONTENT_TYPES: Record<string, { kind: AssetKind; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/gif': { kind: 'image', ext: 'gif' },
  'image/webp': { kind: 'image', ext: 'webp' },
  // Accepted only for the fallback path: if optimizeImage() fails on a HEIC/HEIF file,
  // the original is stored as-is and the signed-URL endpoint must accept it.
  'image/heic': { kind: 'image', ext: 'heic' },
  'image/heif': { kind: 'image', ext: 'heif' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/webm': { kind: 'video', ext: 'webm' },
}

export function assetInfoFor(contentType: string): { kind: AssetKind; ext: string } | null {
  return CONTENT_TYPES[contentType] ?? null
}

export function objectKeyFor(ext: string): string {
  return `assets/${randomUUID()}.${ext}`
}
