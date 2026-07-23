import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateEmail } from '@/lib/manage'

const emailSchema = z.email()

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ managementToken: string; id: string }> },
) {
  const { managementToken, id } = await params
  const body = await req.json().catch(() => ({}))
  const newEmail = String(body.email ?? '').trim()
  if (!newEmail || !emailSchema.safeParse(newEmail).success)
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })

  const ok = await updateEmail(managementToken, id, newEmail)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
