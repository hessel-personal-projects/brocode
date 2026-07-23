import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetDb } from './helpers/db'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/crypto'
import { makeCodeHash } from './helpers/seed'
import { POST } from '@/app/api/dispatch-email/route'

async function seedBrocode() {
  return prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: 'assets/x.png',
      assetContentType: 'image/png',
      assetKind: 'image',
      participants: {
        create: [{ role: 'creator', name: 'Alice', email: 'a@x.com', ...makeCodeHash('111111') }],
      },
    },
  })
}

function makeReq(token: string, body: object) {
  return new Request('http://localhost/api/dispatch-email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/dispatch-email', () => {
  beforeEach(async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture')
    await resetDb()
  })

  it('returns 401 with no auth header', async () => {
    const res = await POST(
      new Request('http://localhost/api/dispatch-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'x@x.com', subject: 'hi', html: '<p>hi</p>' }),
      }) as any,
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 for an unknown management token', async () => {
    const res = await POST(makeReq('bad-token', { to: 'x@x.com', subject: 'hi', html: '<p>hi</p>' }) as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    const b = await seedBrocode()
    const res = await POST(makeReq(b.managementToken, { to: 'x@x.com' }) as any)
    expect(res.status).toBe(400)
  })

  it('returns messageId in capture mode without sending', async () => {
    const b = await seedBrocode()
    const res = await POST(
      makeReq(b.managementToken, {
        to: 'bob@x.com',
        subject: 'Your code',
        html: '<p>code: 123456</p>',
      }) as any,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messageId).toBeTruthy()
    expect(typeof body.messageId).toBe('string')
  })
})
