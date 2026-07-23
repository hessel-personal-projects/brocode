import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import { verifyCode, generateToken } from './crypto'

function makeHash(code: string): { codeHash: string; codeSalt: string } {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(code, salt, 100_000, 32, 'sha256')
  return { codeHash: hash.toString('base64'), codeSalt: salt.toString('base64') }
}

describe('verifyCode', () => {
  it('accepts the correct code', () => {
    const { codeHash, codeSalt } = makeHash('654321')
    expect(verifyCode('654321', codeHash, codeSalt)).toBe(true)
  })

  it('rejects a wrong code', () => {
    const { codeHash, codeSalt } = makeHash('654321')
    expect(verifyCode('000000', codeHash, codeSalt)).toBe(false)
  })

  it('rejects tampered hash', () => {
    const { codeHash, codeSalt } = makeHash('654321')
    const tampered = 'A'.repeat(codeHash.length)
    expect(verifyCode('654321', tampered, codeSalt)).toBe(false)
  })
})

describe('generateToken', () => {
  it('is url-safe and unique', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(20)
  })
})
