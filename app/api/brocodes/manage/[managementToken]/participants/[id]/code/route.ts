import { NextResponse } from 'next/server'
import { updateCodeHash } from '@/lib/manage'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ managementToken: string; id: string }> },
) {
  const { managementToken, id } = await params
  const body = await req.json().catch(() => ({}))
  const codeHash = String(body.codeHash ?? '').trim()
  const codeSalt = String(body.codeSalt ?? '').trim()
  if (!codeHash || !codeSalt) {
    return NextResponse.json({ error: 'codeHash and codeSalt required' }, { status: 400 })
  }
  const ok = await updateCodeHash(managementToken, id, codeHash, codeSalt)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
