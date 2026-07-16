import { NextResponse } from 'next/server'
import { resendContactEmail } from '@/lib/manage'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ managementToken: string }> },
) {
  const { managementToken } = await params
  const body = await req.json().catch(() => ({}))
  const participantId = String(body.participantId ?? '')
  const ok = await resendContactEmail(managementToken, participantId)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
