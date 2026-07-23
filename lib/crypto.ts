import crypto from 'node:crypto'

export function verifyCode(submitted: string, storedHash: string, storedSalt: string): boolean {
  const salt = Buffer.from(storedSalt, 'base64')
  const hash = crypto.pbkdf2Sync(submitted, salt, 100_000, 32, 'sha256').toString('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash))
  } catch {
    return false
  }
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}
