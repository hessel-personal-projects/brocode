import { NextResponse } from 'next/server'
import { consumeViewToken } from '@/lib/view'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ viewToken: string }> },
) {
  const { viewToken } = await params
  const result = await consumeViewToken(viewToken)
  if (!result) return NextResponse.json({ error: 'invalid or expired token' }, { status: 410 })
  return NextResponse.json(result)
}
