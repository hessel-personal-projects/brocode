import { NextRequest, NextResponse } from 'next/server'
import { assetInfoFor, objectKeyFor, MAX_FILE_BYTES } from '@/lib/validation'
import { createSignedUploadUrl } from '@/lib/storage'

export async function POST(req: NextRequest) {
  let body: { contentType: string; size: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (body.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file exceeds 5MB' }, { status: 400 })
  }

  const assetInfo = assetInfoFor(body.contentType)
  if (!assetInfo) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: 400 })
  }

  const objectKey = objectKeyFor(assetInfo.ext)
  const uploadUrl = await createSignedUploadUrl(objectKey)

  return NextResponse.json({ objectKey, uploadUrl, assetKind: assetInfo.kind })
}
