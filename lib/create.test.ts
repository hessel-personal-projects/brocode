import { describe, it, expect, beforeEach } from 'vitest'
import { createBrocode, ValidationError } from './create'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { makeCodeHash, makeCreatorHash } from '@/tests/helpers/seed'
import { MAX_FILE_BYTES } from './validation'

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

function input(overrides: Record<string, unknown> = {}) {
  return {
    creatorName: 'Alice',
    creatorEmail: 'alice@example.com',
    ...makeCreatorHash('111111'),
    title: 'Secret',
    contacts: [
      { name: 'Bob', email: 'bob@example.com', ...makeCodeHash('222222') },
      { name: 'Cara', email: 'cara@example.com', ...makeCodeHash('333333') },
    ],
    objectKey: 'assets/test.png',
    contentType: 'image/png' as const,
    assetKind: 'image' as const,
    ...overrides,
  }
}

describe('createBrocode', () => {
  beforeEach(resetDb)

  it('creates a brocode with creator + contacts and returns participant ids', async () => {
    const result = await createBrocode(input())
    expect(result.managementToken).toBeTruthy()
    expect(result.unlockToken).toBeTruthy()
    expect(result.participants).toHaveLength(3)

    const brocode = await prisma.brocode.findFirst({
      where: { managementToken: result.managementToken },
      include: { participants: true },
    })
    expect(brocode?.participants).toHaveLength(3)
    expect(brocode?.participants.find((p) => p.role === 'creator')?.email).toBe('alice@example.com')
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
    const contacts = Array.from({ length: 11 }, (_, i) => ({
      name: `C${i}`,
      email: `c${i}@x.com`,
      ...makeCodeHash(`00000${i}`),
    }))
    await expect(createBrocode(input({ contacts }))).rejects.toBeInstanceOf(ValidationError)
  })
})
