import crypto from 'node:crypto'

function key(): Buffer {
  const raw = Buffer.from(process.env.CODE_ENCRYPTION_KEY ?? '', 'base64')
  if (raw.length !== 32) {
    throw new Error('CODE_ENCRYPTION_KEY must decode to 32 bytes (base64)')
  }
  return raw
}

export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function encryptCode(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decryptCode(blob: string): string {
  const buf = Buffer.from(blob, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

export function verifyCode(submitted: string, blob: string): boolean {
  let expected: string
  try {
    expected = decryptCode(blob)
  } catch {
    return false
  }
  const a = Buffer.from(submitted)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}
