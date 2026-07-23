import { NextRequest, NextResponse } from 'next/server'
import https from 'node:https'
import crypto from 'node:crypto'
import { updateDeliveryStatus, type EmailDeliveryStatus } from '@/lib/manage'

const STATUS_MAP: Partial<Record<string, EmailDeliveryStatus>> = {
  Delivery: 'DELIVERED',
  Bounce: 'BOUNCED',
  Complaint: 'FAILED',
}

function fetchCert(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

function buildSigningString(msg: Record<string, string>): string {
  const fields =
    msg.Type === 'Notification'
      ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
      : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  return fields
    .filter((k) => msg[k] !== undefined)
    .map((k) => `${k}\n${msg[k]}\n`)
    .join('')
}

async function verifySns(msg: Record<string, string>): Promise<boolean> {
  const certUrl = msg.SigningCertURL ?? ''
  if (!certUrl.match(/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\/.*\.pem$/)) return false
  const cert = await fetchCert(certUrl)
  const verify = crypto.createVerify('RSA-SHA1')
  verify.update(buildSigningString(msg))
  return verify.verify(cert, msg.Signature, 'base64')
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  let msg: Record<string, string>
  try {
    msg = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Skip signature verification in test environment
  if (process.env.NODE_ENV !== 'test') {
    const valid = await verifySns(msg).catch(() => false)
    if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const allowedTopicArn = process.env.SNS_TOPIC_ARN
  if (allowedTopicArn && msg.TopicArn !== allowedTopicArn) {
    return NextResponse.json({ error: 'unauthorized topic' }, { status: 403 })
  }

  // Auto-confirm SNS subscription
  if (msg.Type === 'SubscriptionConfirmation' && msg.SubscribeURL) {
    await fetch(msg.SubscribeURL).catch(() => null)
    return NextResponse.json({ ok: true })
  }

  if (msg.Type !== 'Notification') return NextResponse.json({ ok: true })

  let event: { notificationType: string; mail: { messageId: string } }
  try {
    event = JSON.parse(msg.Message)
  } catch {
    return NextResponse.json({ ok: true })
  }

  const status = STATUS_MAP[event.notificationType]
  if (status && event.mail?.messageId) {
    await updateDeliveryStatus(event.mail.messageId, status)
  }

  return NextResponse.json({ ok: true })
}
