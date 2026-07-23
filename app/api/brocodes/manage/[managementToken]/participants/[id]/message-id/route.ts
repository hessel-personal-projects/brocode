import { NextResponse } from 'next/server'
import { registerMessageId } from '@/lib/manage'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ managementToken: string; id: string }> },
) {
  const { managementToken, id } = await params
  const body = await req.json().catch(() => ({}))
  const messageId = String(body.messageId ?? '').trim()
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })
  const ok = await registerMessageId(managementToken, id, messageId)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
