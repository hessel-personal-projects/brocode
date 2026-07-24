import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createBrocode, ValidationError } from '@/lib/create'
import { prisma } from '@/lib/prisma'
import { resetDb } from './helpers/db'
import { makeCreatorHash, makeCodeHash } from './helpers/seed'

const TINY_PNG = fs.readFileSync(path.join(__dirname, '../e2e/fixtures/tiny.png'))

const BASE_INPUT = {
  creatorName: 'Alice',
  creatorEmail: 'alice@example.com',
  ...makeCreatorHash('111111'),
  contacts: [{ name: 'Bob', email: 'bob@example.com', ...makeCodeHash('222222') }],
  objectKey: 'assets/test.png',
  contentType: 'image/png' as const,
  assetKind: 'image' as const,
}

describe('createBrocode', () => {
  beforeEach(resetDb)

  it('stores creatorEmail on creator participant', async () => {
    const result = await createBrocode(BASE_INPUT)

    const creator = await prisma.participant.findFirst({
      where: { brocode: { managementToken: result.managementToken }, role: 'creator' },
    })
    expect(creator?.email).toBe('alice@example.com')
    expect(creator?.emailDeliveryStatus).toBe('PENDING')
  })

  it('returns only managementToken — no creatorCode', async () => {
    const result = await createBrocode(BASE_INPUT)

    expect(result.managementToken).toBeTruthy()
    expect((result as unknown as Record<string, unknown>).creatorCode).toBeUndefined()
  })

  it('rejects an invalid creatorEmail', async () => {
    await expect(
      createBrocode({ ...BASE_INPUT, creatorEmail: 'not-an-email' }),
    ).rejects.toThrow(ValidationError)
  })
})
