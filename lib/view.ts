import { prisma } from './prisma'
import { createSignedUrl } from './storage'
import { SIGNED_URL_TTL_SECONDS } from './constants'
import type { AssetKind } from './validation'

export interface ViewResult {
  assetKind: AssetKind
  signedUrl: string
}

export async function consumeViewToken(viewToken: string): Promise<ViewResult | null> {
  const session = await prisma.unlockSession.findUnique({
    where: { viewToken },
    include: { brocode: true },
  })
  if (!session || !session.viewTokenExpiresAt) return null

  const now = new Date()
  if (session.viewTokenUsedAt) return null
  if (session.viewTokenExpiresAt <= now) return null

  // atomic single-use claim
  const claim = await prisma.unlockSession.updateMany({
    where: { id: session.id, viewTokenUsedAt: null },
    data: { viewTokenUsedAt: now },
  })
  if (claim.count === 0) return null

  const signedUrl = await createSignedUrl(session.brocode.assetObjectKey, SIGNED_URL_TTL_SECONDS)
  return { assetKind: session.brocode.assetKind as AssetKind, signedUrl }
}
