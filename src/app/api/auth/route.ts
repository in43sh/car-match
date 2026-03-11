import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'DASHBOARD_PASSWORD not configured' }, { status: 500 })
  }

  if (password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  // Set session cookie — value is AUTH_SECRET itself (single-user, no JWT needed)
  const secret = process.env.AUTH_SECRET ?? process.env.DASHBOARD_PASSWORD
  const cookieStore = await cookies()
  cookieStore.set('carmatch_session', secret, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return NextResponse.json({ ok: true })
}
