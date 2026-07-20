import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createBrocode, ValidationError } from './create'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { clearCapturedEmails, getCapturedEmails } from '@/lib/email/capture'
import { MAX_FILE_BYTES } from './validation'

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

function input(overrides = {}) {
  return {
    creatorName: 'Alice',
    creatorEmail: 'alice@example.com',
    title: 'Secret',
    contacts: [
      { name: 'Bob', email: 'bob@example.com' },
      { name: 'Cara', email: 'cara@example.com' },
    ],
    file: { buffer: pngBuffer, contentType: 'image/png', size: pngBuffer.length },
    ...overrides,
  }
}

describe('createBrocode', () => {
  beforeEach(async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture')
    await resetDb()
    clearCapturedEmails()
  })

  it('creates a brocode with creator + contacts and emails all participants', async () => {
    const result = await createBrocode(input())
    expect(result.managementToken).toBeTruthy()

    const brocode = await prisma.brocode.findFirst({
      where: { managementToken: result.managementToken },
      include: { participants: true },
    })
    expect(brocode?.participants).toHaveLength(3)

    const creator = brocode!.participants.find((p) => p.role === 'creator')!
    expect(creator.email).toBe('alice@example.com')

    const captured = getCapturedEmails()
    expect(captured.map((e) => e.to).sort()).toEqual(['alice@example.com', 'bob@example.com', 'cara@example.com'])
    expect(
      captured.filter((e) => e.to !== 'alice@example.com').every((e) => e.unlockUrl.includes(brocode!.unlockToken)),
    ).toBe(true)
  })

  it('rejects an unsupported file type', async () => {
    await expect(
      createBrocode(input({ file: { buffer: Buffer.from('x'), contentType: 'application/pdf', size: 1 } })),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects a file over 5MB', async () => {
    await expect(
      createBrocode(input({ file: { buffer: pngBuffer, contentType: 'image/png', size: MAX_FILE_BYTES + 1 } })),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects 0 contacts', async () => {
    await expect(createBrocode(input({ contacts: [] }))).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects 11 contacts', async () => {
    const contacts = Array.from({ length: 11 }, (_, i) => ({ name: `C${i}`, email: `c${i}@x.com` }))
    await expect(createBrocode(input({ contacts }))).rejects.toBeInstanceOf(ValidationError)
  })
})
