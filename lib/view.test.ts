import { describe, it, expect, beforeEach } from 'vitest'
import { consumeViewToken } from './view'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { generateToken } from './crypto'
import { VIEW_TOKEN_TTL_MS } from './constants'

async function seedCompletedSession(opts: { used?: boolean; expired?: boolean } = {}) {
  const brocode = await prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: 'assets/x.png',
      assetContentType: 'image/png',
      assetKind: 'image',
      participants: { create: [{ role: 'creator', name: 'Alice', email: null, codeEncrypted: 'x' }] },
    },
  })
  const viewToken = generateToken()
  const now = Date.now()
  await prisma.unlockSession.create({
    data: {
      brocodeId: brocode.id,
      matchedParticipantIds: [],
      expiresAt: new Date(now - 1000),
      completedAt: new Date(now),
      viewToken,
      viewTokenExpiresAt: new Date(now + (opts.expired ? -1000 : VIEW_TOKEN_TTL_MS)),
      viewTokenUsedAt: opts.used ? new Date(now) : null,
    },
  })
  return viewToken
}

describe('consumeViewToken', () => {
  beforeEach(resetDb)

  it('returns null for an unknown token', async () => {
    expect(await consumeViewToken('nope')).toBeNull()
  })

  it('returns a signed url + kind for a valid token, then marks it used', async () => {
    const token = await seedCompletedSession()
    const result = await consumeViewToken(token)
    expect(result?.assetKind).toBe('image')
    expect(result?.signedUrl).toContain('token=')

    const session = await prisma.unlockSession.findFirst({ where: { viewToken: token } })
    expect(session?.viewTokenUsedAt).not.toBeNull()
  })

  it('returns null on the second use (single-use)', async () => {
    const token = await seedCompletedSession()
    await consumeViewToken(token)
    expect(await consumeViewToken(token)).toBeNull()
  })

  it('returns null for an expired token', async () => {
    const token = await seedCompletedSession({ expired: true })
    expect(await consumeViewToken(token)).toBeNull()
  })

  it('returns null for an already-used token', async () => {
    const token = await seedCompletedSession({ used: true })
    expect(await consumeViewToken(token)).toBeNull()
  })
})
