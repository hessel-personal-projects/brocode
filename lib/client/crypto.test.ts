import { describe, it, expect } from 'vitest'
import {
  generateAssetKey,
  keyToFragment,
  fragmentToKey,
  encryptFile,
  decryptAsset,
  generateCode,
  generateSalt,
  saltToBase64,
  hashCode,
} from './crypto'
import crypto from 'node:crypto'

describe('asset key round-trip', () => {
  it('encodes and decodes key from fragment', () => {
    const key = generateAssetKey()
    const fragment = keyToFragment(key)
    const decoded = fragmentToKey(fragment)
    expect(decoded).toEqual(key)
  })

  it('generates different keys each call', () => {
    expect(keyToFragment(generateAssetKey())).not.toBe(keyToFragment(generateAssetKey()))
  })
})

describe('file encryption round-trip', () => {
  it('decrypts to original bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const file = new File([bytes], 'test.bin')
    const { ciphertext, key } = await encryptFile(file)
    const plain = await decryptAsset(ciphertext.buffer, key)
    expect(new Uint8Array(plain)).toEqual(bytes)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'test.bin')
    const { ciphertext: a } = await encryptFile(file)
    const { ciphertext: b } = await encryptFile(file)
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'))
  })

  it('ciphertext starts with 12-byte IV', async () => {
    const file = new File([new Uint8Array([0])], 'test.bin')
    const { ciphertext } = await encryptFile(file)
    expect(ciphertext.length).toBeGreaterThan(12)
  })
})

describe('generateCode', () => {
  it('is always 6 numeric digits', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/)
    }
  })
})

describe('hashCode', () => {
  it('produces consistent output for same input', async () => {
    const salt = generateSalt()
    const a = await hashCode('123456', salt)
    const b = await hashCode('123456', salt)
    expect(a).toBe(b)
  })

  it('matches Node pbkdf2Sync with same parameters', async () => {
    const salt = generateSalt()
    const browserHash = await hashCode('654321', salt)
    const nodeHash = crypto
      .pbkdf2Sync('654321', salt, 100_000, 32, 'sha256')
      .toString('base64')
    expect(browserHash).toBe(nodeHash)
  })

  it('different codes produce different hashes', async () => {
    const salt = generateSalt()
    const a = await hashCode('111111', salt)
    const b = await hashCode('222222', salt)
    expect(a).not.toBe(b)
  })
})

describe('saltToBase64', () => {
  it('round-trips through Buffer.from', () => {
    const salt = generateSalt()
    const b64 = saltToBase64(salt)
    const restored = Buffer.from(b64, 'base64')
    expect(new Uint8Array(restored)).toEqual(salt)
  })
})
