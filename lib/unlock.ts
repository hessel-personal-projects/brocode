import { prisma } from './prisma'
import { UNLOCK_SESSION_TTL_MS } from './constants'
import type { UnlockState } from './types'
import { verifyCode, generateToken } from './crypto'
import { LOCKOUT_MS, VIEW_TOKEN_TTL_MS } from './constants'

type SessionShape = { matchedParticipantIds: unknown; expiresAt: Date }

export function matchedIds(session: { matchedParticipantIds: unknown }): string[] {
  return Array.isArray(session.matchedParticipantIds)
    ? (session.matchedParticipantIds as string[])
    : []
}

export function buildProgress(
  participants: { id: string; name: string }[],
  session: SessionShape,
): UnlockState {
  const matched = matchedIds(session)
  return {
    status: 'in_progress',
    participants: participants.map((p) => ({ id: p.id, name: p.name, matched: matched.includes(p.id) })),
    matchedCount: matched.length,
    total: participants.length,
    expiresAt: session.expiresAt.toISOString(),
  }
}

export async function loadUnlockState(unlockToken: string): Promise<UnlockState | null> {
  const brocode = await prisma.brocode.findUnique({
    where: { unlockToken },
    include: { participants: true },
  })
  if (!brocode) return null

  const now = new Date()
  if (brocode.lockedUntil && brocode.lockedUntil > now) {
    return { status: 'locked', lockedUntil: brocode.lockedUntil.toISOString() }
  }

  await prisma.unlockSession.deleteMany({
    where: { brocodeId: brocode.id, completedAt: null, expiresAt: { lte: now } },
  })

  let session = await prisma.unlockSession.findFirst({
    where: { brocodeId: brocode.id, completedAt: null, expiresAt: { gt: now } },
    orderBy: { startedAt: 'desc' },
  })

  if (!session) {
    session = await prisma.unlockSession.create({
      data: {
        brocodeId: brocode.id,
        matchedParticipantIds: [],
        expiresAt: new Date(now.getTime() + UNLOCK_SESSION_TTL_MS),
      },
    })
  }

  return buildProgress(brocode.participants, session)
}

export async function submitCode(unlockToken: string, code: string): Promise<UnlockState | null> {
  const brocode = await prisma.brocode.findUnique({
    where: { unlockToken },
    include: { participants: true },
  })
  if (!brocode) return null

  const now = new Date()
  if (brocode.lockedUntil && brocode.lockedUntil > now) {
    return { status: 'locked', lockedUntil: brocode.lockedUntil.toISOString() }
  }

  const session = await prisma.unlockSession.findFirst({
    where: { brocodeId: brocode.id, completedAt: null, expiresAt: { gt: now } },
    orderBy: { startedAt: 'desc' },
  })
  if (!session) return { status: 'expired' }

  const matched = matchedIds(session)
  const unmatched = brocode.participants.filter((p) => !matched.includes(p.id))
  const hit = unmatched.find((p) => verifyCode(code, p.codeEncrypted))

  if (!hit) {
    const lockedUntil = new Date(now.getTime() + LOCKOUT_MS)
    await prisma.$transaction([
      prisma.brocode.update({ where: { id: brocode.id }, data: { lockedUntil } }),
      prisma.unlockSession.delete({ where: { id: session.id } }),
    ])
    return { status: 'detonated', lockedUntil: lockedUntil.toISOString() }
  }

  const newMatched = [...matched, hit.id]
  if (newMatched.length === brocode.participants.length) {
    const viewToken = generateToken()
    await prisma.unlockSession.update({
      where: { id: session.id },
      data: {
        matchedParticipantIds: newMatched,
        completedAt: now,
        viewToken,
        viewTokenExpiresAt: new Date(now.getTime() + VIEW_TOKEN_TTL_MS),
      },
    })
    return { status: 'unlocked', viewToken }
  }

  await prisma.unlockSession.update({
    where: { id: session.id },
    data: { matchedParticipantIds: newMatched },
  })
  return buildProgress(brocode.participants, { matchedParticipantIds: newMatched, expiresAt: session.expiresAt })
}
