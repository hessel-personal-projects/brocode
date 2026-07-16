'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Countdown } from '@/app/components/Countdown'

type Contact = { id: string; name: string; email: string }
type ManageData = {
  title: string | null
  locked: boolean
  lockedUntil: string | null
  creatorCode: string
  unlockToken: string
  contacts: Contact[]
}

export default function ManagePage() {
  const { managementToken } = useParams<{ managementToken: string }>()
  const [data, setData] = useState<ManageData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/brocodes/manage/${managementToken}`)
    if (res.status === 404) return setNotFound(true)
    setData(await res.json())
  }, [managementToken])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function resend(id: string) {
    const res = await fetch(`/api/brocodes/manage/${managementToken}/resend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantId: id }),
    })
    setNotice(res.ok ? 'Email re-sent' : 'Resend failed')
  }

  async function remove() {
    if (!confirm('Delete this Brocode and its media permanently?')) return
    const res = await fetch(`/api/brocodes/manage/${managementToken}`, { method: 'DELETE' })
    if (res.ok) setDeleted(true)
  }

  if (notFound) return <main className="p-6" data-testid="notfound">Not found.</main>
  if (deleted) return <main className="p-6" data-testid="deleted">Deleted.</main>
  if (!data) return <main className="p-6">Loading…</main>

  const unlockUrl = `${window.location.origin}/unlock/${data.unlockToken}`

  return (
    <main className="mx-auto max-w-lg p-6 space-y-4">
      <h1 className="text-2xl font-bold">Manage Brocode{data.title ? `: ${data.title}` : ''}</h1>

      {data.locked && data.lockedUntil && (
        <p className="rounded bg-red-50 p-3 text-red-800" data-testid="locked-notice">
          Locked — unlocks in <Countdown until={data.lockedUntil} />
        </p>
      )}

      <div>
        <p className="text-sm text-gray-600">Your code</p>
        <p data-testid="creator-code" className="text-3xl font-bold tracking-widest">{data.creatorCode}</p>
      </div>

      <div>
        <p className="text-sm text-gray-600">Shared unlock link</p>
        <a className="break-all text-blue-700 underline" href={unlockUrl}>{unlockUrl}</a>
      </div>

      <div>
        <p className="text-sm text-gray-600">Contacts</p>
        <ul className="space-y-2">
          {data.contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span>{c.name} — {c.email}</span>
              <button onClick={() => resend(c.id)} className="rounded border px-2 py-1 text-sm"
                data-testid={`resend-${c.id}`}>Resend</button>
            </li>
          ))}
        </ul>
      </div>

      {notice && <p data-testid="notice" className="text-sm text-green-700">{notice}</p>}

      <button onClick={remove} className="rounded bg-red-700 px-4 py-2 text-white" data-testid="delete">
        Delete Brocode
      </button>
    </main>
  )
}
