import { prisma } from './prisma'
import { generateCode, encryptCode, generateToken } from './crypto'
import { assetInfoFor, objectKeyFor, MAX_FILE_BYTES, createSchema } from './validation'
import { uploadAsset } from './storage'
import { getEmailService } from './email'

export class ValidationError extends Error {
  status = 400
}

export interface CreateInput {
  creatorName: string
  creatorEmail: string
  title?: string
  contacts: { name: string; email: string }[]
  file: { buffer: Buffer; contentType: string; size: number }
}

export interface CreateResult {
  managementToken: string
}

export async function createBrocode(input: CreateInput): Promise<CreateResult> {
  const parsed = createSchema.safeParse({
    creatorName: input.creatorName,
    creatorEmail: input.creatorEmail,
    title: input.title,
    contacts: input.contacts,
  })
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)

  if (input.file.size > MAX_FILE_BYTES) throw new ValidationError('file exceeds 5MB')
  const assetInfo = assetInfoFor(input.file.contentType)
  if (!assetInfo) throw new ValidationError('unsupported file type')

  const managementToken = generateToken()
  const unlockToken = generateToken()
  const objectKey = objectKeyFor(assetInfo.ext)

  await uploadAsset(objectKey, input.file.buffer, input.file.contentType)

  const creatorCode = generateCode()
  const contacts = parsed.data.contacts.map((c) => ({ ...c, code: generateCode() }))

  const brocode = await prisma.brocode.create({
    data: {
      managementToken,
      unlockToken,
      assetObjectKey: objectKey,
      assetContentType: input.file.contentType,
      assetKind: assetInfo.kind,
      title: parsed.data.title ?? null,
      participants: {
        create: [
          {
            role: 'creator',
            name: parsed.data.creatorName,
            email: parsed.data.creatorEmail,
            codeEncrypted: encryptCode(creatorCode),
          },
          ...contacts.map((c) => ({
            role: 'contact' as const,
            name: c.name,
            email: c.email,
            codeEncrypted: encryptCode(c.code),
          })),
        ],
      },
    },
    include: { participants: true },
  })

  const emailSvc = getEmailService()
  const unlockUrl = `${process.env.APP_BASE_URL}/unlock/${unlockToken}`
  const manageUrl = `${process.env.APP_BASE_URL}/manage/${managementToken}`

  const creatorParticipant = brocode.participants.find((p) => p.role === 'creator')!
  const contactParticipants = brocode.participants.filter((p) => p.role === 'contact')

  try {
    const { resendEmailId } = await emailSvc.sendCreatorEmail({
      to: parsed.data.creatorEmail,
      creatorName: parsed.data.creatorName,
      code: creatorCode,
      managementUrl: manageUrl,
      unlockUrl,
      title: parsed.data.title,
    })
    if (resendEmailId) {
      await prisma.participant.update({
        where: { id: creatorParticipant.id },
        data: { resendEmailId },
      })
    }
  } catch (err) {
    console.error(`failed to email creator ${parsed.data.creatorEmail}:`, err)
  }

  await Promise.all(
    contacts.map(async (c) => {
      const participant = contactParticipants.find((p) => p.email === c.email)!
      try {
        const { resendEmailId } = await emailSvc.sendContactCode({
          to: c.email,
          contactName: c.name,
          code: c.code,
          unlockUrl,
          title: parsed.data.title,
        })
        if (resendEmailId) {
          await prisma.participant.update({
            where: { id: participant.id },
            data: { resendEmailId },
          })
        }
      } catch (err) {
        console.error(`failed to email ${c.email}:`, err)
      }
    }),
  )

  return { managementToken }
}
