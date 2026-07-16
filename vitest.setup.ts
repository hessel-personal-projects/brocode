import { config } from 'dotenv'
import { afterAll } from 'vitest'

config({ path: '.env.local' })

afterAll(async () => {
  // Disconnect the Prisma client to cleanly close the pg connection pool
  const { prisma } = await import('@/lib/prisma')
  await prisma.$disconnect()
})
