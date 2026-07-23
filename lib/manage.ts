import { prisma } from './prisma'
import { removeAsset } from './storage'
import { type EmailDeliveryStatus } from './email'

export interface ManageContact {
  id: string
  name: string
  email: string
  emailDeliveryStatus: EmailDeliveryStatus
}

export interface ManageCreator {
  id: string
  email: string
  emailDeliveryStatus: EmailDeliveryStatus
}

export interface ManageData {
  title: string | null
  locked: boolean
  lockedUntil: string | null
  unlockToken: string
  creator: ManageCreator
  contacts: ManageContact[]
}

export async function getManageData(managementToken: string): Promise<ManageData | null> {
  const brocode = await prisma.brocode.findUnique({
    where: { managementToken },
    include: { participants: true },
  })
  if (!brocode) return null

  const creator = brocode.participants.find((p) => p.role === 'creator')!
  const now = new Date()
  const locked = !!brocode.lockedUntil && brocode.lockedUntil > now

  return {
    title: brocode.title,
    locked,
    lockedUntil: locked ? brocode.lockedUntil!.toISOString() : null,
    unlockToken: brocode.unlockToken,
    creator: {
      id: creator.id,
      email: creator.email,
      emailDeliveryStatus: creator.emailDeliveryStatus as EmailDeliveryStatus,
    },
    contacts: brocode.participants
      .filter((p) => p.role === 'contact')
      .map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        emailDeliveryStatus: p.emailDeliveryStatus as EmailDeliveryStatus,
      })),
  }
}

export async function resendContactEmail(managementToken: string, participantId: string): Promise<boolean> {
  // TODO(Task 9): code is now hashed — email dispatch is client-driven
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, brocodeId: brocode.id, role: 'contact' },
  })
  if (!participant) return false
  await prisma.participant.update({
    where: { id: participantId },
    data: { emailDeliveryStatus: 'PENDING' },
  })
  return true
}

export async function updateAndResendEmail(
  managementToken: string,
  participantId: string,
  newEmail: string,
): Promise<boolean> {
  // TODO(Task 9): code is now hashed — email dispatch is client-driven
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, brocodeId: brocode.id },
  })
  if (!participant) return false

  await prisma.participant.update({
    where: { id: participantId },
    data: { email: newEmail, emailDeliveryStatus: 'PENDING' },
  })

  return true
}

export async function updateDeliveryStatus(
  emailMessageId: string,
  status: EmailDeliveryStatus,
): Promise<void> {
  await prisma.participant.updateMany({
    where: { emailMessageId },
    data: { emailDeliveryStatus: status },
  })
}

export async function deleteBrocode(managementToken: string): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false

  await prisma.brocode.delete({ where: { id: brocode.id } })
  await removeAsset(brocode.assetObjectKey)
  return true
}
