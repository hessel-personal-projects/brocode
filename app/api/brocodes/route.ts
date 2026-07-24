import { NextRequest, NextResponse } from 'next/server'
import { createBrocode, ValidationError } from '@/lib/create'
import { type AssetKind } from '@/lib/validation'

export async function POST(req: NextRequest) {
  let body: {
    objectKey: string
    contentType: string
    assetKind: string
    creatorName: string
    creatorEmail: string
    creatorCodeHash: string
    creatorCodeSalt: string
    title?: string
    contacts: { name: string; email: string; codeHash: string; codeSalt: string }[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  try {
    const result = await createBrocode({
      creatorName: body.creatorName,
      creatorEmail: body.creatorEmail,
      creatorCodeHash: body.creatorCodeHash,
      creatorCodeSalt: body.creatorCodeSalt,
      title: body.title,
      contacts: body.contacts,
      objectKey: body.objectKey,
      contentType: body.contentType,
      assetKind: body.assetKind as AssetKind,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
