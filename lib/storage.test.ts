import { describe, it, expect } from 'vitest'
import { uploadAsset, createSignedUrl, removeAsset } from './storage'
import { generateToken } from './crypto'

describe('storage', () => {
  it('uploads, signs, fetches, then removes an object', async () => {
    const key = `test/${generateToken(8)}.txt`
    await uploadAsset(key, Buffer.from('hello brocode'), 'text/plain')

    const url = await createSignedUrl(key, 60)
    const res = await fetch(url)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('hello brocode')

    await removeAsset(key)
    const afterUrl = await createSignedUrl(key, 60).catch(() => null)
    if (afterUrl) {
      const gone = await fetch(afterUrl)
      expect(gone.status).toBeGreaterThanOrEqual(400)
    }
  })
})
