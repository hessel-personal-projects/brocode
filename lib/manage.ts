import { prisma } from './prisma'
import { decryptCode } from './crypto'
import { removeAsset } from './storage'
import { getEmailService, type EmailDeliveryStatus } from './email'

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
  const brocode = await prisma.brocode.findUnique({
    where: { managementToken },
    include: { participants: true },
  })
  if (!brocode) return false

  const participant = brocode.participants.find((p) => p.id === participantId && p.role === 'contact')
  if (!participant) return false

  await prisma.participant.update({
    where: { id: participantId },
    data: { emailDeliveryStatus: 'PENDING' },
  })

  const unlockUrl = `${process.env.APP_BASE_URL}/unlock/${brocode.unlockToken}`
  await getEmailService().sendContactCode({
    to: participant.email,
    contactName: participant.name,
    code: decryptCode(participant.codeEncrypted),
    unlockUrl,
    title: brocode.title ?? undefined,
  })

  return true
}

export async function updateAndResendEmail(
  managementToken: string,
  participantId: string,
  newEmail: string,
): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({
    where: { managementToken },
    include: { participants: true },
  })
  if (!brocode) return false

  const participant = brocode.participants.find((p) => p.id === participantId)
  if (!participant) return false

  await prisma.participant.update({
    where: { id: participantId },
    data: { email: newEmail, emailDeliveryStatus: 'PENDING' },
  })

  const emailSvc = getEmailService()
  const unlockUrl = `${process.env.APP_BASE_URL}/unlock/${brocode.unlockToken}`
  const code = decryptCode(participant.codeEncrypted)

  if (participant.role === 'creator') {
    const manageUrl = `${process.env.APP_BASE_URL}/manage/${managementToken}`
    await emailSvc.sendCreatorEmail({
      to: newEmail,
      creatorName: participant.name,
      code,
      managementUrl: manageUrl,
      unlockUrl,
      title: brocode.title ?? undefined,
    })
  } else {
    await emailSvc.sendContactCode({
      to: newEmail,
      contactName: participant.name,
      code,
      unlockUrl,
      title: brocode.title ?? undefined,
    })
  }

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
