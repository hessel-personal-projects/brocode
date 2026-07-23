import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { makeCodeHash } from '@/tests/helpers/seed'

describe('prisma round-trip', () => {
  beforeEach(resetDb)

  it('creates and reads a Brocode with participants', async () => {
    const created = await prisma.brocode.create({
      data: {
        managementToken: 'mtok',
        unlockToken: 'utok',
        assetObjectKey: 'assets/x.png',
        assetContentType: 'image/png',
        assetKind: 'image',
        participants: {
          create: [
            { role: 'creator', name: 'Alice', email: 'alice@example.com', ...makeCodeHash('111111') },
            { role: 'contact', name: 'Bob', email: 'bob@example.com', ...makeCodeHash('222222') },
          ],
        },
      },
      include: { participants: true },
    })
    expect(created.participants).toHaveLength(2)

    const found = await prisma.brocode.findUnique({ where: { unlockToken: 'utok' } })
    expect(found?.managementToken).toBe('mtok')
  })
})
