import { NextResponse } from 'next/server'
import { updateAndResendEmail } from '@/lib/manage'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ managementToken: string; id: string }> },
) {
  const { managementToken, id } = await params
  const body = await req.json().catch(() => ({}))
  const newEmail = String(body.email ?? '').trim()
  if (!newEmail) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const ok = await updateAndResendEmail(managementToken, id, newEmail)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
