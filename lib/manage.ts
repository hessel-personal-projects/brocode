import { prisma } from './prisma'
import { decryptCode } from './crypto'
import { removeAsset } from './storage'
import { getEmailService } from './email'

export interface ManageContact {
  id: string
  name: string
  email: string
}

export interface ManageData {
  title: string | null
  locked: boolean
  lockedUntil: string | null
  creatorCode: string
  unlockToken: string
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
    creatorCode: decryptCode(creator.codeEncrypted),
    unlockToken: brocode.unlockToken,
    contacts: brocode.participants
      .filter((p) => p.role === 'contact')
      .map((p) => ({ id: p.id, name: p.name, email: p.email! })),
  }
}

export async function resendContactEmail(managementToken: string, participantId: string): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({
    where: { managementToken },
    include: { participants: true },
  })
  if (!brocode) return false

  const participant = brocode.participants.find((p) => p.id === participantId && p.role === 'contact')
  if (!participant || !participant.email) return false

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

export async function deleteBrocode(managementToken: string): Promise<boolean> {
  const brocode = await prisma.brocode.findUnique({ where: { managementToken } })
  if (!brocode) return false

  await removeAsset(brocode.assetObjectKey)
  await prisma.brocode.delete({ where: { id: brocode.id } })
  return true
}
