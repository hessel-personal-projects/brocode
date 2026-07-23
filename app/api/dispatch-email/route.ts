import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSesTransporter } from '@/lib/email/ses'

interface DispatchBody {
  to: string
  subject: string
  html: string
  text?: string
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const brocode = await prisma.brocode.findUnique({ where: { managementToken: token } })
  if (!brocode) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: DispatchBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.to || !body.subject || !body.html) {
    return NextResponse.json({ error: 'to, subject, html required' }, { status: 400 })
  }

  // Capture mode for development/testing — never logs body
  if (process.env.EMAIL_TRANSPORT === 'capture') {
    const id = `capture-${Date.now()}-${Math.random().toString(36).slice(2)}`
    return NextResponse.json({ messageId: id })
  }

  try {
    const transporter = createSesTransporter()
    const info = await transporter.sendMail({
      from: process.env.SES_FROM_ADDRESS!,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
    })
    // Strip angle brackets from Nodemailer's messageId to match SES event format
    const messageId = (info.messageId as string).replace(/^<|>$/g, '')
    return NextResponse.json({ messageId })
  } catch {
    return NextResponse.json({ error: 'dispatch failed' }, { status: 502 })
  }
}
