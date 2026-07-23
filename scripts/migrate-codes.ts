import dotenv from 'dotenv'
import path from 'node:path'
import crypto from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { decryptCode } from '../lib/crypto'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function hashCode(plaintext: string): Promise<{ codeHash: string; codeSalt: string }> {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(plaintext, salt, 100_000, 32, 'sha256')
  return { codeHash: hash.toString('base64'), codeSalt: salt.toString('base64') }
}

async function main() {
  const participants = await prisma.participant.findMany({
    where: { codeHash: null },
  })
  console.log(`Migrating ${participants.length} participants…`)

  let skipped = 0
  for (const p of participants) {
    try {
      const plaintext = decryptCode(p.codeEncrypted)
      const { codeHash, codeSalt } = await hashCode(plaintext)

      // verify round-trip before writing
      const verify = crypto.pbkdf2Sync(plaintext, Buffer.from(codeSalt, 'base64'), 100_000, 32, 'sha256').toString('base64')
      if (!crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(verify))) {
        throw new Error(`Hash verification failed for participant ${p.id}`)
      }

      await prisma.participant.update({
        where: { id: p.id },
        data: {
          codeHash,
          codeSalt,
          emailMessageId: p.resendEmailId ?? null,
        },
      })
      console.log(`  ✓ ${p.id}`)
    } catch (err) {
      console.error(`⚠ Skipping ${p.id}: ${err instanceof Error ? err.message : String(err)}`)
      skipped++
    }
  }
  console.log(`Migration complete. Migrated: ${participants.length - skipped}, Skipped: ${skipped}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
