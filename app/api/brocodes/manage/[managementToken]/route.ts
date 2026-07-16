import { NextResponse } from 'next/server'
import { getManageData, deleteBrocode } from '@/lib/manage'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ managementToken: string }> },
) {
  const { managementToken } = await params
  const data = await getManageData(managementToken)
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ managementToken: string }> },
) {
  const { managementToken } = await params
  const ok = await deleteBrocode(managementToken)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
