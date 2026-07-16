import { describe, it, expect } from 'vitest'
import { generateCode, encryptCode, decryptCode, verifyCode, generateToken } from './crypto'

describe('generateCode', () => {
  it('is always 6 numeric digits', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode()
      expect(code).toMatch(/^\d{6}$/)
    }
  })
})

describe('encrypt/decrypt', () => {
  it('round-trips a code', () => {
    const blob = encryptCode('123456')
    expect(decryptCode(blob)).toBe('123456')
  })

  it('produces different ciphertext each call (random IV)', () => {
    expect(encryptCode('123456')).not.toBe(encryptCode('123456'))
  })

  it('does not contain the plaintext', () => {
    expect(encryptCode('123456')).not.toContain('123456')
  })
})

describe('verifyCode', () => {
  it('accepts the correct code', () => {
    expect(verifyCode('654321', encryptCode('654321'))).toBe(true)
  })
  it('rejects a wrong code', () => {
    expect(verifyCode('000000', encryptCode('654321'))).toBe(false)
  })
  it('returns false on tampered ciphertext instead of throwing', () => {
    const blob = encryptCode('654321')
    const tampered = 'A' + blob.slice(1)
    expect(verifyCode('654321', tampered)).toBe(false)
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
