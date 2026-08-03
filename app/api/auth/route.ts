import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'brocode_auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!process.env.ACCESS_PASSWORD || password !== process.env.ACCESS_PASSWORD) {
    return NextResponse.json({ error: 'invalid' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, process.env.ACCESS_PASSWORD, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
