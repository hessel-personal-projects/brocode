import { prisma } from './prisma'
import { UNLOCK_SESSION_TTL_MS } from './constants'
import type { UnlockState } from './types'

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
