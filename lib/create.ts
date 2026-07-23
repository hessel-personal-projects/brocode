import { prisma } from './prisma'
import { generateToken } from './crypto'
import { assetInfoFor, objectKeyFor, MAX_FILE_BYTES } from './validation'
import { uploadAsset } from './storage'
import { z } from 'zod'

export class ValidationError extends Error {
  status = 400
}

const participantSchema = z.object({
  name: z.string().trim().min(1, 'name required'),
  email: z.email('invalid email'),
  codeHash: z.string().min(1, 'codeHash required'),
  codeSalt: z.string().min(1, 'codeSalt required'),
})

export const createInputSchema = z.object({
  creatorName: z.string().trim().min(1, 'creator name required'),
  creatorEmail: z.email('invalid creator email'),
  creatorCodeHash: z.string().min(1, 'creatorCodeHash required'),
  creatorCodeSalt: z.string().min(1, 'creatorCodeSalt required'),
  title: z.string().trim().max(200).optional(),
  contacts: z.array(participantSchema).min(1, 'at least 1 contact').max(10, 'at most 10 contacts'),
})

export interface CreateInput {
  creatorName: string
  creatorEmail: string
  creatorCodeHash: string
  creatorCodeSalt: string
  title?: string
  contacts: { name: string; email: string; codeHash: string; codeSalt: string }[]
  file: { buffer: Buffer; contentType: string; size: number }
}

export interface CreateResult {
  managementToken: string
  unlockToken: string
  participants: { id: string; email: string; role: string }[]
}

export async function createBrocode(input: CreateInput): Promise<CreateResult> {
  const parsed = createInputSchema.safeParse({
    creatorName: input.creatorName,
    creatorEmail: input.creatorEmail,
    creatorCodeHash: input.creatorCodeHash,
    creatorCodeSalt: input.creatorCodeSalt,
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
            codeHash: parsed.data.creatorCodeHash,
            codeSalt: parsed.data.creatorCodeSalt,
          },
          ...parsed.data.contacts.map((c) => ({
            role: 'contact' as const,
            name: c.name,
            email: c.email,
            codeHash: c.codeHash,
            codeSalt: c.codeSalt,
          })),
        ],
      },
    },
    include: { participants: true },
  })

  return {
    managementToken,
    unlockToken,
    participants: brocode.participants.map((p) => ({ id: p.id, email: p.email, role: p.role })),
  }
}
