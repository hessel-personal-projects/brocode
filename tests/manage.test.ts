import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createBrocode } from '@/lib/create'
import { getManageData, updateDeliveryStatus, updateAndResendEmail } from '@/lib/manage'
import { prisma } from '@/lib/prisma'
import { resetDb } from './helpers/db'
import { makeCreatorHash, makeCodeHash } from './helpers/seed'

const TINY_PNG = fs.readFileSync(path.join(__dirname, '../e2e/fixtures/tiny.png'))

const BASE_INPUT = {
  creatorName: 'Alice',
  creatorEmail: 'alice@example.com',
  ...makeCreatorHash('111111'),
  contacts: [{ name: 'Bob', email: 'bob@example.com', ...makeCodeHash('222222') }],
  file: { buffer: TINY_PNG, contentType: 'image/png', size: TINY_PNG.length },
}

describe('getManageData', () => {
  beforeEach(async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture')
    await resetDb()
  })

  it('returns creator email and delivery status', async () => {
    const { managementToken } = await createBrocode(BASE_INPUT)
    const data = await getManageData(managementToken)

    expect(data?.creator.email).toBe('alice@example.com')
    expect(data?.creator.emailDeliveryStatus).toBe('PENDING')
    expect(data?.contacts[0].emailDeliveryStatus).toBe('PENDING')
  })

  it('does not expose creatorCode', async () => {
    const { managementToken } = await createBrocode(BASE_INPUT)
    const data = await getManageData(managementToken)

    expect((data as Record<string, unknown>).creatorCode).toBeUndefined()
  })
})

describe('updateDeliveryStatus', () => {
  beforeEach(async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture')
    await resetDb()
  })

  it('updates participant status by resendEmailId', async () => {
    const { managementToken } = await createBrocode(BASE_INPUT)
    const creator = await prisma.participant.findFirst({
      where: { brocode: { managementToken }, role: 'creator' },
    })
    await prisma.participant.update({
      where: { id: creator!.id },
      data: { emailMessageId: 'fake-email-id' },
    })

    await updateDeliveryStatus('fake-email-id', 'DELIVERED')

    const updated = await prisma.participant.findUnique({ where: { id: creator!.id } })
    expect(updated?.emailDeliveryStatus).toBe('DELIVERED')
  })

  it('is a no-op for an unknown resendEmailId', async () => {
    await expect(updateDeliveryStatus('nonexistent-id', 'DELIVERED')).resolves.toBeUndefined()
  })
})

describe('updateAndResendEmail', () => {
  beforeEach(async () => {
    vi.stubEnv('EMAIL_TRANSPORT', 'capture')
    await resetDb()
  })

  it('updates contact email and resets delivery status to PENDING', async () => {
    const { managementToken } = await createBrocode(BASE_INPUT)
    const contact = await prisma.participant.findFirst({
      where: { brocode: { managementToken }, role: 'contact' },
    })
    await prisma.participant.update({
      where: { id: contact!.id },
      data: { emailDeliveryStatus: 'BOUNCED' },
    })

    const ok = await updateAndResendEmail(managementToken, contact!.id, 'bob-new@example.com')

    expect(ok).toBe(true)
    const updated = await prisma.participant.findUnique({ where: { id: contact!.id } })
    expect(updated?.email).toBe('bob-new@example.com')
    expect(updated?.emailDeliveryStatus).toBe('PENDING')
  })

  it('returns false for unknown managementToken', async () => {
    const ok = await updateAndResendEmail('bad-token', 'bad-id', 'x@example.com')
    expect(ok).toBe(false)
  })
})
