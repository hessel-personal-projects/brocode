import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'resend is now client-driven — use dispatch-email + participants/[id]/code' },
    { status: 410 },
  )
}
