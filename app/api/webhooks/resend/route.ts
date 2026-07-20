import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { updateDeliveryStatus } from '@/lib/manage'
import type { EmailDeliveryStatus } from '@/lib/email/types'

type ResendEvent = {
  type: string
  data: { email_id: string }
}

const STATUS_MAP: Partial<Record<string, EmailDeliveryStatus>> = {
  'email.delivered': 'DELIVERED',
  'email.bounced': 'BOUNCED',
  'email.failed': 'FAILED',
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const body = await req.text()
  const svixId = req.headers.get('svix-id') ?? ''
  const svixTimestamp = req.headers.get('svix-timestamp') ?? ''
  const svixSignature = req.headers.get('svix-signature') ?? ''

  let event: ResendEvent
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendEvent
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const status = STATUS_MAP[event.type]
  if (status) {
    await updateDeliveryStatus(event.data.email_id, status)
  }

  return NextResponse.json({ ok: true })
}
