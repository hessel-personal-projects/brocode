import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createBrocode } from '@/lib/create'
import { prisma } from '@/lib/prisma'
import { resetDb } from './helpers/db'
import { POST } from '@/app/api/webhooks/resend/route'

// Mock svix so tests don't need real SVIX signatures.
// verify() succeeds when svix-signature === 'valid', otherwise throws.
vi.mock('svix', () => ({
  Webhook: class {
    verify(body: string, headers: Record<string, string>) {
      if (headers['svix-signature'] === 'valid') return JSON.parse(body)
      throw new Error('Invalid signature')
    }
  },
}))

const TINY_PNG = fs.readFileSync(path.join(__dirname, '../e2e/fixtures/tiny.png'))

const BASE_INPUT = {
  creatorName: 'Alice',
  creatorEmail: 'alice@example.com',
  contacts: [{ name: 'Bob', email: 'bob@example.com' }],
  file: { buffer: TINY_PNG, contentType: 'image/png', size: TINY_PNG.length },
}

function makeRequest(body: object, sig = 'valid') {
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'svix-id': 'msg-1',
      'svix-timestamp': '1700000000',
      'svix-signature': sig,
    },
  })
}

describe('POST /api/webhooks/resend', () => {
  beforeEach(async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture')
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_test')
    await resetDb()
  })

  it('returns 500 when RESEND_WEBHOOK_SECRET is not set', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '')
    const res = await POST(makeRequest({}) as any)
    expect(res.status).toBe(500)
  })

  it('returns 400 for an invalid signature', async () => {
    const res = await POST(makeRequest({ type: 'email.delivered', data: { email_id: 'x' } }, 'bad') as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid signature')
  })

  it('updates delivery status to DELIVERED for email.delivered', async () => {
    const { managementToken } = await createBrocode(BASE_INPUT)
    const participant = await prisma.participant.findFirst({
      where: { brocode: { managementToken } },
    })
    await prisma.participant.update({
      where: { id: participant!.id },
      data: { resendEmailId: 'resend-abc-123' },
    })

    const res = await POST(
      makeRequest({ type: 'email.delivered', data: { email_id: 'resend-abc-123' } }) as any,
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const updated = await prisma.participant.findUnique({ where: { id: participant!.id } })
    expect(updated?.emailDeliveryStatus).toBe('DELIVERED')
  })

  it('updates delivery status to BOUNCED for email.bounced', async () => {
    const { managementToken } = await createBrocode(BASE_INPUT)
    const participant = await prisma.participant.findFirst({
      where: { brocode: { managementToken } },
    })
    await prisma.participant.update({
      where: { id: participant!.id },
      data: { resendEmailId: 'resend-bounce-id' },
    })

    const res = await POST(
      makeRequest({ type: 'email.bounced', data: { email_id: 'resend-bounce-id' } }) as any,
    )
    expect(res.status).toBe(200)
    const updated = await prisma.participant.findUnique({ where: { id: participant!.id } })
    expect(updated?.emailDeliveryStatus).toBe('BOUNCED')
  })

  it('ignores unknown event types and returns ok without updating DB', async () => {
    const { managementToken } = await createBrocode(BASE_INPUT)
    const participant = await prisma.participant.findFirst({
      where: { brocode: { managementToken } },
    })
    await prisma.participant.update({
      where: { id: participant!.id },
      data: { resendEmailId: 'resend-open-id' },
    })

    const res = await POST(
      makeRequest({ type: 'email.opened', data: { email_id: 'resend-open-id' } }) as any,
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const updated = await prisma.participant.findUnique({ where: { id: participant!.id } })
    expect(updated?.emailDeliveryStatus).toBe('PENDING')
  })
})
