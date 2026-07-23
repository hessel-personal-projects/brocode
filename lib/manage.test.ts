import { describe, it, expect, beforeEach } from 'vitest'
import { getManageData, deleteBrocode } from './manage'
import { prisma } from '@/lib/prisma'
import { resetDb } from '@/tests/helpers/db'
import { clearCapturedEmails } from '@/lib/email/capture'
import { uploadAsset } from './storage'
import { generateToken } from './crypto'
import { makeCodeHash } from '@/tests/helpers/seed'
import { objectKeyFor } from './validation'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

async function seed() {
  const key = objectKeyFor('png')
  await uploadAsset(key, png, 'image/png')
  return prisma.brocode.create({
    data: {
      managementToken: generateToken(),
      unlockToken: generateToken(),
      assetObjectKey: key,
      assetContentType: 'image/png',
      assetKind: 'image',
      title: 'Secret',
      participants: {
        create: [
          { role: 'creator', name: 'Alice', email: 'alice@example.com', ...makeCodeHash('111111') },
          { role: 'contact', name: 'Bob', email: 'bob@x.com', ...makeCodeHash('222222') },
        ],
      },
    },
    include: { participants: true },
  })
}

describe('getManageData', () => {
  beforeEach(async () => {
    await resetDb()
    clearCapturedEmails()
  })

  it('returns the decrypted creator code, contacts, unlock token, and unlocked status', async () => {
    const b = await seed()
    const data = await getManageData(b.managementToken)
    expect(data?.creator.email).toBe('alice@example.com')
    expect(data?.title).toBe('Secret')
    expect(data?.locked).toBe(false)
    expect(data?.lockedUntil).toBeNull()
    expect(data?.unlockToken).toBe(b.unlockToken)
    expect(data?.contacts).toEqual([{ id: b.participants.find((p) => p.role === 'contact')!.id, name: 'Bob', email: 'bob@x.com', emailDeliveryStatus: 'PENDING' }])
  })

  it('reports locked with lockedUntil when in the future', async () => {
    const b = await seed()
    const future = new Date(Date.now() + 60_000)
    await prisma.brocode.update({ where: { id: b.id }, data: { lockedUntil: future } })
    const data = await getManageData(b.managementToken)
    expect(data?.locked).toBe(true)
    expect(data?.lockedUntil).toBe(future.toISOString())
  })

  it('returns null for an unknown token', async () => {
    expect(await getManageData('nope')).toBeNull()
  })
})

// resendContactEmail removed — email dispatch is now client-driven (see Task 9)

describe('deleteBrocode', () => {
  beforeEach(resetDb)

  it('removes the asset and all records', async () => {
    const b = await seed()
    const ok = await deleteBrocode(b.managementToken)
    expect(ok).toBe(true)
    expect(await prisma.brocode.findUnique({ where: { id: b.id } })).toBeNull()
    expect(await prisma.participant.count({ where: { brocodeId: b.id } })).toBe(0)
  })

  it('returns false for an unknown token', async () => {
    expect(await deleteBrocode('nope')).toBe(false)
  })
})
