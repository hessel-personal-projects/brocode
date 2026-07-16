import { describe, it, expect, beforeEach } from 'vitest'
import { loadUnlockState } from './unlock'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { encryptCode, generateToken } from './crypto'

async function seed(opts: { lockedUntil?: Date } = {}) {
  return prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: 'assets/x.png',
      assetContentType: 'image/png',
      assetKind: 'image',
      lockedUntil: opts.lockedUntil ?? null,
      participants: {
        create: [
          { role: 'creator', name: 'Alice', email: null, codeEncrypted: encryptCode('111111') },
          { role: 'contact', name: 'Bob', email: 'bob@x.com', codeEncrypted: encryptCode('222222') },
        ],
      },
    },
  })
}

describe('loadUnlockState', () => {
  beforeEach(resetDb)

  it('returns null for an unknown token', async () => {
    expect(await loadUnlockState('nope')).toBeNull()
  })

  it('returns locked when lockedUntil is in the future', async () => {
    const future = new Date(Date.now() + 60_000)
    const b = await seed({ lockedUntil: future })
    const state = await loadUnlockState(b.unlockToken)
    expect(state).toEqual({ status: 'locked', lockedUntil: future.toISOString() })
  })

  it('starts a fresh session with 0 of N when unlocked', async () => {
    const b = await seed()
    const state = await loadUnlockState(b.unlockToken)
    expect(state?.status).toBe('in_progress')
    if (state?.status !== 'in_progress') throw new Error('bad state')
    expect(state.total).toBe(2)
    expect(state.matchedCount).toBe(0)
    expect(state.participants.map((p) => p.name).sort()).toEqual(['Alice', 'Bob'])
    expect(state.participants.every((p) => !p.matched)).toBe(true)

    const sessions = await prisma.unlockSession.count({ where: { brocodeId: b.id } })
    expect(sessions).toBe(1)
  })

  it('discards an expired session and starts fresh', async () => {
    const b = await seed()
    await prisma.unlockSession.create({
      data: { brocodeId: b.id, matchedParticipantIds: [], expiresAt: new Date(Date.now() - 1000) },
    })
    const state = await loadUnlockState(b.unlockToken)
    expect(state?.status).toBe('in_progress')
    const active = await prisma.unlockSession.findMany({ where: { brocodeId: b.id } })
    expect(active).toHaveLength(1)
    expect(active[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('reuses an existing active session', async () => {
    const b = await seed()
    await loadUnlockState(b.unlockToken)
    await loadUnlockState(b.unlockToken)
    const sessions = await prisma.unlockSession.count({ where: { brocodeId: b.id } })
    expect(sessions).toBe(1)
  })
})
