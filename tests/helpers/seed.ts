import crypto from 'node:crypto'

export function makeCodeHash(code: string): { codeHash: string; codeSalt: string } {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(code, salt, 100_000, 32, 'sha256')
  return { codeHash: hash.toString('base64'), codeSalt: salt.toString('base64') }
}

export function seedParticipant(code: string, overrides: Record<string, unknown> = {}) {
  return { ...makeCodeHash(code), ...overrides }
}
