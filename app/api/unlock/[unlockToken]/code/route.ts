import { NextResponse } from 'next/server'
import { submitCode } from '@/lib/unlock'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ unlockToken: string }> },
) {
  const { unlockToken } = await params
  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '')
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'code must be 6 digits' }, { status: 400 })
  }
  const state = await submitCode(unlockToken, code)
  if (!state) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(state)
}
