import { prisma } from '@/lib/prisma'

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "UnlockSession","Participant","Brocode" RESTART IDENTITY CASCADE',
  )
}
