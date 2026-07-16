import { NextRequest, NextResponse } from 'next/server'
import { createBrocode, ValidationError } from '@/lib/create'
import { MAX_FILE_BYTES } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const cl = Number(req.headers.get('content-length') ?? 0)
  if (cl > MAX_FILE_BYTES + 65536) {
    return NextResponse.json({ error: 'request too large' }, { status: 413 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    let contacts: { name: string; email: string }[]
    try {
      contacts = JSON.parse(String(form.get('contacts') ?? '[]'))
    } catch {
      return NextResponse.json({ error: 'invalid contacts' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const titleRaw = form.get('title')

    const result = await createBrocode({
      creatorName: String(form.get('creatorName') ?? ''),
      title: titleRaw ? String(titleRaw) : undefined,
      contacts,
      file: { buffer, contentType: file.type, size: file.size },
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
