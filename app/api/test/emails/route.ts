import { NextResponse } from 'next/server'
import { getCapturedEmails, clearCapturedEmails } from '@/lib/email/capture'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json(getCapturedEmails())
}

export async function DELETE() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  clearCapturedEmails()
  return NextResponse.json({ ok: true })
}
