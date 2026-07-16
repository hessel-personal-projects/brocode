export type ParticipantProgress = { id: string; name: string; matched: boolean }

export type UnlockState =
  | { status: 'locked'; lockedUntil: string }
  | { status: 'in_progress'; participants: ParticipantProgress[]; matchedCount: number; total: number; expiresAt: string }
  | { status: 'expired' }
  | { status: 'detonated'; lockedUntil: string }
  | { status: 'unlocked'; viewToken: string }
