import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock browser globals before importing the module under test.
// OffscreenCanvas and createImageBitmap are not available in Node.
const mockConvertToBlob = vi.fn()
const mockDrawImage = vi.fn()

vi.stubGlobal(
  'OffscreenCanvas',
  vi.fn().mockImplementation(function (_w: number, _h: number) {
    return {
      getContext: () => ({ drawImage: mockDrawImage }),
      convertToBlob: mockConvertToBlob,
    }
  }),
)

vi.stubGlobal(
  'createImageBitmap',
  vi.fn(async () => ({ width: 200, height: 150, close: vi.fn() })),
)

vi.mock('heic2any', () => ({
  default: vi.fn(async () => new Blob(['jpeg-data'], { type: 'image/jpeg' })),
}))

// Import AFTER stubbing globals so the module captures the mocked versions.
const { optimizeImage } = await import('./imageOptimizer')
const { default: heic2any } = await import('heic2any')

describe('optimizeImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConvertToBlob.mockResolvedValue(new Blob(['webp-data'], { type: 'image/webp' }))
  })

  it('returns video files unchanged without touching canvas', async () => {
    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
    const result = await optimizeImage(file)
    expect(result).toBe(file)
    expect((globalThis as any).createImageBitmap).not.toHaveBeenCalled()
  })

  it('returns GIF unchanged without touching canvas', async () => {
    const file = new File(['data'], 'anim.gif', { type: 'image/gif' })
    const result = await optimizeImage(file)
    expect(result).toBe(file)
    expect((globalThis as any).createImageBitmap).not.toHaveBeenCalled()
  })

  it('converts JPEG to WebP at quality 0.85', async () => {
    const file = new File(['jpeg-data'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await optimizeImage(file)
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('photo.webp')
    expect(mockConvertToBlob).toHaveBeenCalledWith({ type: 'image/webp', quality: 0.85 })
  })

  it('converts PNG to WebP', async () => {
    const file = new File(['png-data'], 'screenshot.png', { type: 'image/png' })
    const result = await optimizeImage(file)
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('screenshot.webp')
  })

  it('converts HEIC via heic2any then to WebP', async () => {
    const file = new File(['heic-data'], 'iphone.heic', { type: 'image/heic' })
    const result = await optimizeImage(file)
    expect(heic2any).toHaveBeenCalledWith({ blob: file, toType: 'image/jpeg' })
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('iphone.webp')
  })

  it('converts HEIF via heic2any then to WebP', async () => {
    const file = new File(['heif-data'], 'burst.heif', { type: 'image/heif' })
    const result = await optimizeImage(file)
    expect(heic2any).toHaveBeenCalledWith({ blob: file, toType: 'image/jpeg' })
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('burst.webp')
  })

  it('strips extension correctly when filename has multiple dots', async () => {
    const file = new File(['data'], 'my.photo.jpeg', { type: 'image/jpeg' })
    const result = await optimizeImage(file)
    expect(result.name).toBe('my.photo.webp')
  })

  it('falls back to original file when createImageBitmap throws', async () => {
    vi.mocked((globalThis as any).createImageBitmap).mockRejectedValueOnce(new Error('decode failed'))
    const file = new File(['data'], 'broken.jpg', { type: 'image/jpeg' })
    const result = await optimizeImage(file)
    expect(result).toBe(file)
  })

  it('falls back to original file when heic2any throws', async () => {
    vi.mocked(heic2any).mockRejectedValueOnce(new Error('unsupported'))
    const file = new File(['data'], 'broken.heic', { type: 'image/heic' })
    const result = await optimizeImage(file)
    expect(result).toBe(file)
  })
})
