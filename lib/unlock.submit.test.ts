import { describe, it, expect, beforeEach } from 'vitest'
import { loadUnlockState, submitCode } from './unlock'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { encryptCode, generateToken } from './crypto'
import { LOCKOUT_MS } from './constants'

// codes: Alice 111111, Bob 222222, Cara 333333
async function seed() {
  return prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: 'assets/x.png',
      assetContentType: 'image/png',
      assetKind: 'image',
      participants: {
        create: [
          { role: 'creator', name: 'Alice', email: null, codeEncrypted: encryptCode('111111') },
          { role: 'contact', name: 'Bob', email: 'b@x.com', codeEncrypted: encryptCode('222222') },
          { role: 'contact', name: 'Cara', email: 'c@x.com', codeEncrypted: encryptCode('333333') },
        ],
      },
    },
  })
}

describe('submitCode', () => {
  beforeEach(resetDb)

  it('returns null for an unknown token', async () => {
    expect(await submitCode('nope', '111111')).toBeNull()
  })

  it('advances progress on a correct code', async () => {
    const b = await seed()
    await loadUnlockState(b.unlockToken) // start session
    const state = await submitCode(b.unlockToken, '222222')
    expect(state?.status).toBe('in_progress')
    if (state?.status !== 'in_progress') throw new Error('bad')
    expect(state.matchedCount).toBe(1)
    expect(state.participants.find((p) => p.name === 'Bob')?.matched).toBe(true)
  })

  it('completes and issues a view token when all match, in any order', async () => {
    const b = await seed()
    await loadUnlockState(b.unlockToken)
    await submitCode(b.unlockToken, '333333') // Cara
    await submitCode(b.unlockToken, '111111') // Alice
    const final = await submitCode(b.unlockToken, '222222') // Bob
    expect(final?.status).toBe('unlocked')
    if (final?.status !== 'unlocked') throw new Error('bad')
    expect(final.viewToken).toBeTruthy()

    const session = await prisma.unlockSession.findFirst({ where: { brocodeId: b.id } })
    expect(session?.completedAt).not.toBeNull()
    expect(session?.viewToken).toBe(final.viewToken)
  })

  it('detonates on a wrong code and deletes the session', async () => {
    const b = await seed()
    await loadUnlockState(b.unlockToken)
    const before = Date.now()
    const state = await submitCode(b.unlockToken, '999999')
    expect(state?.status).toBe('detonated')
    if (state?.status !== 'detonated') throw new Error('bad')

    const lockedUntil = new Date(state.lockedUntil).getTime()
    expect(lockedUntil).toBeGreaterThanOrEqual(before + LOCKOUT_MS - 5000)
    expect(lockedUntil).toBeLessThanOrEqual(Date.now() + LOCKOUT_MS + 5000)

    const sessions = await prisma.unlockSession.count({ where: { brocodeId: b.id } })
    expect(sessions).toBe(0)

    const brocode = await prisma.brocode.findUnique({ where: { id: b.id } })
    expect(brocode?.lockedUntil).not.toBeNull()
  })

  it('rejects submits while locked', async () => {
    const b = await seed()
    await prisma.brocode.update({
      where: { id: b.id },
      data: { lockedUntil: new Date(Date.now() + 60_000) },
    })
    const state = await submitCode(b.unlockToken, '111111')
    expect(state?.status).toBe('locked')
  })

  it('returns expired when no active session exists', async () => {
    const b = await seed()
    // no loadUnlockState → no session created
    const state = await submitCode(b.unlockToken, '111111')
    expect(state?.status).toBe('expired')
  })

  it('does not re-match an already-matched participant (re-entering a used code detonates)', async () => {
    const b = await seed()
    await loadUnlockState(b.unlockToken)
    await submitCode(b.unlockToken, '222222') // Bob matched
    const state = await submitCode(b.unlockToken, '222222') // Bob already matched → no unmatched match
    expect(state?.status).toBe('detonated')
  })
})
