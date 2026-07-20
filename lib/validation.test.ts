import { describe, it, expect } from 'vitest'
import { assetInfoFor, createSchema, objectKeyFor, MAX_FILE_BYTES } from './validation'

describe('assetInfoFor', () => {
  it('maps allowed image types', () => {
    expect(assetInfoFor('image/png')).toEqual({ kind: 'image', ext: 'png' })
    expect(assetInfoFor('image/jpeg')?.kind).toBe('image')
    expect(assetInfoFor('image/gif')?.kind).toBe('image')
    expect(assetInfoFor('image/webp')?.kind).toBe('image')
  })
  it('maps allowed video types', () => {
    expect(assetInfoFor('video/mp4')).toEqual({ kind: 'video', ext: 'mp4' })
    expect(assetInfoFor('video/webm')?.kind).toBe('video')
  })
  it('rejects disallowed types', () => {
    expect(assetInfoFor('application/pdf')).toBeNull()
    expect(assetInfoFor('text/plain')).toBeNull()
  })
})

describe('createSchema', () => {
  const base = { creatorName: 'Alice', creatorEmail: 'alice@example.com', contacts: [{ name: 'Bob', email: 'bob@x.com' }] }

  it('accepts 1 contact', () => {
    expect(createSchema.safeParse(base).success).toBe(true)
  })
  it('accepts 10 contacts', () => {
    const contacts = Array.from({ length: 10 }, (_, i) => ({ name: `C${i}`, email: `c${i}@x.com` }))
    expect(createSchema.safeParse({ ...base, contacts }).success).toBe(true)
  })
  it('rejects 0 contacts', () => {
    expect(createSchema.safeParse({ ...base, contacts: [] }).success).toBe(false)
  })
  it('rejects 11 contacts', () => {
    const contacts = Array.from({ length: 11 }, (_, i) => ({ name: `C${i}`, email: `c${i}@x.com` }))
    expect(createSchema.safeParse({ ...base, contacts }).success).toBe(false)
  })
  it('rejects an invalid email', () => {
    expect(createSchema.safeParse({ ...base, contacts: [{ name: 'Bob', email: 'nope' }] }).success).toBe(false)
  })
  it('rejects a blank creator name', () => {
    expect(createSchema.safeParse({ ...base, creatorName: '' }).success).toBe(false)
  })
})

describe('objectKeyFor', () => {
  it('produces a random assets/<uuid>.<ext> path', () => {
    const a = objectKeyFor('png')
    const b = objectKeyFor('png')
    expect(a).toMatch(/^assets\/[0-9a-f-]{36}\.png$/)
    expect(a).not.toBe(b)
  })
})

describe('constants', () => {
  it('MAX_FILE_BYTES is 5MB', () => {
    expect(MAX_FILE_BYTES).toBe(5 * 1024 * 1024)
  })
})
