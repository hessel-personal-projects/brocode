import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { resetDb } from './helpers/db'
import { generateToken } from '@/lib/crypto'
import { makeCodeHash } from './helpers/seed'
import { POST } from '@/app/api/webhooks/email/route'

vi.stubEnv('NODE_ENV', 'test') // skip SNS signature verification

const TINY_PNG = fs.readFileSync(path.join(__dirname, '../e2e/fixtures/tiny.png'))

async function seedWithMessageId(messageId: string) {
  const brocode = await prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: 'assets/x.png',
      assetContentType: 'image/png',
      assetKind: 'image',
      participants: {
        create: [{ role: 'creator', name: 'Alice', email: 'a@x.com', ...makeCodeHash('111111'), emailMessageId: messageId }],
      },
    },
    include: { participants: true },
  })
  return brocode.participants[0]
}

function snsNotification(notificationType: string, messageId: string) {
  return new Request('http://localhost/api/webhooks/email', {
    method: 'POST',
    body: JSON.stringify({
      Type: 'Notification',
      MessageId: 'sns-msg-1',
      TopicArn: 'arn:aws:sns:us-east-1:123:topic',
      Message: JSON.stringify({ notificationType, mail: { messageId } }),
      Timestamp: '2026-01-01T00:00:00Z',
      Signature: 'fake',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/cert.pem',
    }),
  })
}

describe('POST /api/webhooks/email', () => {
  beforeEach(resetDb)

  it('returns 400 for invalid json', async () => {
    const res = await POST(
      new Request('http://localhost/api/webhooks/email', { method: 'POST', body: 'not-json' }) as any,
    )
    expect(res.status).toBe(400)
  })

  it('updates delivery status to DELIVERED on Delivery event', async () => {
    const participant = await seedWithMessageId('ses-msg-abc')
    const res = await POST(snsNotification('Delivery', 'ses-msg-abc') as any)
    expect(res.status).toBe(200)
    const updated = await prisma.participant.findUnique({ where: { id: participant.id } })
    expect(updated?.emailDeliveryStatus).toBe('DELIVERED')
  })

  it('updates delivery status to BOUNCED on Bounce event', async () => {
    const participant = await seedWithMessageId('ses-msg-bounce')
    await POST(snsNotification('Bounce', 'ses-msg-bounce') as any)
    const updated = await prisma.participant.findUnique({ where: { id: participant.id } })
    expect(updated?.emailDeliveryStatus).toBe('BOUNCED')
  })

  it('ignores unknown event types', async () => {
    const participant = await seedWithMessageId('ses-msg-open')
    await POST(snsNotification('Open', 'ses-msg-open') as any)
    const updated = await prisma.participant.findUnique({ where: { id: participant.id } })
    expect(updated?.emailDeliveryStatus).toBe('PENDING')
  })

  it('auto-confirms SubscriptionConfirmation (returns 200)', async () => {
    const res = await POST(
      new Request('http://localhost/api/webhooks/email', {
        method: 'POST',
        body: JSON.stringify({
          Type: 'SubscriptionConfirmation',
          SubscribeURL: 'https://example.com/confirm',
          Message: '',
          MessageId: 'x',
          Timestamp: '',
          TopicArn: 'arn:x',
          Token: 'tok',
          Signature: 'x',
          SigningCertURL: 'https://sns.us-east-1.amazonaws.com/cert.pem',
        }),
      }) as any,
    )
    expect(res.status).toBe(200)
  })
})
