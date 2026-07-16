import { NextResponse } from 'next/server'
import { loadUnlockState } from '@/lib/unlock'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ unlockToken: string }> },
) {
  const { unlockToken } = await params
  const state = await loadUnlockState(unlockToken)
  if (!state) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(state)
}
