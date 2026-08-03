import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'brocode_auth'

export function middleware(req: NextRequest) {
  // No password configured — allow everything (dev/test)
  if (!process.env.ACCESS_PASSWORD) return NextResponse.next()

  const { pathname } = req.nextUrl

  // Login page and ceremony routes always accessible — ceremony URLs are
  // already protected by their own tokens (unlockToken, viewToken)
  if (
    pathname === '/login' ||
    pathname.startsWith('/unlock/') ||
    pathname.startsWith('/view/')
  ) return NextResponse.next()

  const cookie = req.cookies.get(COOKIE)
  if (cookie?.value === process.env.ACCESS_PASSWORD) return NextResponse.next()

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
}
