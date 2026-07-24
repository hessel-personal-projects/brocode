import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createBrocode } from '@/lib/create'
import { prisma } from '@/lib/prisma'
import { resetDb } from './helpers/db'
import { makeCreatorHash, makeCodeHash } from './helpers/seed'
import { PATCH } from '@/app/api/brocodes/manage/[managementToken]/participants/[id]/route'

const TINY_PNG = fs.readFileSync(path.join(__dirname, '../e2e/fixtures/tiny.png'))

const BASE_INPUT = {
  creatorName: 'Alice',
  creatorEmail: 'alice@example.com',
  ...makeCreatorHash('111111'),
  contacts: [{ name: 'Bob', email: 'bob@example.com', ...makeCodeHash('222222') }],
  objectKey: 'assets/test.png',
  contentType: 'image/png' as const,
  assetKind: 'image' as const,
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/brocodes/manage/x/participants/y', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('PATCH /api/brocodes/manage/[managementToken]/participants/[id]', () => {
  beforeEach(async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture')
    await resetDb()
  })

  it('returns 400 when email is missing', async () => {
    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ managementToken: 'any', id: 'any' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('valid email required')
  })

  it('returns 400 when email is empty string', async () => {
    const res = await PATCH(makeRequest({ email: '   ' }), {
      params: Promise.resolve({ managementToken: 'any', id: 'any' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown managementToken', async () => {
    const res = await PATCH(makeRequest({ email: 'new@example.com' }), {
      params: Promise.resolve({ managementToken: 'bad-token', id: 'bad-id' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('not found')
  })

  it('updates participant email and returns ok', async () => {
    const { managementToken } = await createBrocode(BASE_INPUT)
    const participant = await prisma.participant.findFirst({
      where: { brocode: { managementToken }, role: 'contact' },
    })

    const res = await PATCH(makeRequest({ email: 'bob-new@example.com' }), {
      params: Promise.resolve({ managementToken, id: participant!.id }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const updated = await prisma.participant.findUnique({ where: { id: participant!.id } })
    expect(updated?.email).toBe('bob-new@example.com')
    expect(updated?.emailDeliveryStatus).toBe('PENDING')
  })

  it('returns 404 for unknown participant id', async () => {
    const { managementToken } = await createBrocode(BASE_INPUT)
    const res = await PATCH(makeRequest({ email: 'new@example.com' }), {
      params: Promise.resolve({ managementToken, id: 'nonexistent-id' }),
    })
    expect(res.status).toBe(404)
  })
})
