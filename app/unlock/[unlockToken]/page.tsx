'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type ParticipantProgress = { id: string; name: string; matched: boolean }
type UnlockState =
  | { status: 'locked'; lockedUntil: string }
  | { status: 'in_progress'; participants: ParticipantProgress[]; matchedCount: number; total: number; expiresAt: string }
  | { status: 'expired' }
  | { status: 'detonated'; lockedUntil: string }
  | { status: 'unlocked'; viewToken: string }
  | { status: 'notfound' }

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, new Date(until).getTime() - now)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return <span data-testid="countdown">{h}h {m}m {s}s</span>
}

export default function UnlockRitual() {
  const { unlockToken } = useParams<{ unlockToken: string }>()
  const router = useRouter()
  const [state, setState] = useState<UnlockState | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/unlock/${unlockToken}`)
    if (res.status === 404) return setState({ status: 'notfound' })
    setState(await res.json())
  }, [unlockToken])

  // intentional: fetch the server-owned unlock state once on mount
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (state?.status === 'unlocked') router.push(`/view/${state.viewToken}`)
  }, [state, router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/unlock/${unlockToken}/code`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const next: UnlockState = await res.json()
      setCode('')
      if (next.status === 'expired') return load()
      setState(next)
    } finally {
      setBusy(false)
    }
  }

  if (!state) return <main className="p-6">Loading…</main>
  if (state.status === 'notfound') return <main className="p-6">Not found.</main>

  if (state.status === 'locked' || state.status === 'detonated') {
    return (
      <main className="mx-auto max-w-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold text-red-700" data-testid="locked">Locked</h1>
        <p>A wrong code was entered. This asset is locked for 24 hours.</p>
        <p>Unlocks in <Countdown until={state.lockedUntil} /></p>
      </main>
    )
  }

  if (state.status === 'expired') {
    return <main className="p-6">Session expired. <button onClick={load} className="underline">Restart</button></main>
  }

  if (state.status === 'unlocked') {
    // the effect above redirects to /view/<viewToken>; render nothing meanwhile
    return <main className="p-6">Unlocking…</main>
  }

  return (
    <main className="mx-auto max-w-lg p-6 space-y-4">
      <h1 className="text-2xl font-bold">Turn every key</h1>
      <p data-testid="progress">{state.matchedCount} of {state.total} keys turned</p>
      <ul className="space-y-1">
        {state.participants.map((p) => (
          <li key={p.id} data-testid={`participant-${p.name}`}>
            {p.matched ? '🔓' : '🔒'} {p.name}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"
          maxLength={6} placeholder="6-digit code" className="w-full rounded border p-2 tracking-widest"
          data-testid="code" />
        <button disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" data-testid="enter">
          Enter
        </button>
      </form>
      <p className="text-xs text-gray-500">One wrong code locks this for 24 hours. No retries.</p>
    </main>
  )
}
