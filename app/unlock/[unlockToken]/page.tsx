'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Countdown } from '@/app/components/Countdown'
import { PageHeader } from '@/app/components/PageHeader'
import { Panel } from '@/app/components/Panel'
import { StationPanel, type StationStatus } from '@/app/components/StationPanel'
import { CodeInput } from '@/app/components/CodeInput'
import { GlowButton } from '@/app/components/GlowButton'
import { TerminalReveal } from '@/app/components/TerminalReveal'
import { StatusIndicator } from '@/app/components/StatusIndicator'

type ParticipantProgress = { id: string; name: string; matched: boolean }
type UnlockState =
  | { status: 'locked'; lockedUntil: string }
  | { status: 'in_progress'; participants: ParticipantProgress[]; matchedCount: number; total: number; expiresAt: string }
  | { status: 'expired' }
  | { status: 'detonated'; lockedUntil: string }
  | { status: 'unlocked'; viewToken: string }
  | { status: 'notfound' }

function gridClass(count: number) {
  if (count <= 2) return 'grid-cols-1'
  if (count <= 4) return 'grid-cols-2'
  return 'grid-cols-2 sm:grid-cols-3'
}

export default function UnlockRitual() {
  const { unlockToken } = useParams<{ unlockToken: string }>()
  const router = useRouter()
  const [state, setState] = useState<UnlockState | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [detonating, setDetonating] = useState(false)
  const [detonationText, setDetonationText] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/unlock/${unlockToken}`)
    if (res.status === 404) return setState({ status: 'notfound' })
    setState(await res.json())
  }, [unlockToken])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (state?.status === 'unlocked') router.push(`/view/${state.viewToken}`)
  }, [state, router])

  async function submit(submittedCode: string) {
    if (!/^\d{6}$/.test(submittedCode)) return
    setBusy(true)
    setCode('')
    try {
      const res = await fetch(`/api/unlock/${unlockToken}/code`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: submittedCode }),
      })
      const next: UnlockState = await res.json()
      if (next.status === 'expired') return load()
      if (next.status === 'detonated') {
        setDetonating(true)
        const msg = '⚠ DETONATION DETECTED'
        // type in the message character by character
        for (let i = 1; i <= msg.length; i++) {
          setDetonationText(msg.slice(0, i))
          await new Promise((r) => setTimeout(r, 30))
        }
      }
      setState(next)
    } finally {
      setBusy(false)
    }
  }

  if (!state) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="LOADING" color="amber" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase animate-pulse" style={{ color: 'var(--color-phosphor-dim)' }}>
            Establishing connection…
          </span>
        </div>
      </div>
    )
  }

  if (state.status === 'notfound') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="NOT FOUND" color="alert" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-alert)' }}>
            Mission ID not found.
          </span>
        </div>
      </div>
    )
  }

  if (state.status === 'locked' || state.status === 'detonated') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" data-testid="locked">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="LOCKOUT ACTIVE" color="alert" />} />
        <TerminalReveal>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <motion.div
              className="text-3xl font-bold tracking-widest uppercase text-center"
              style={{
                color: 'var(--color-alert)',
                textShadow: '0 0 8px var(--color-alert), 0 0 24px var(--color-alert)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {detonating ? detonationText : '⚠ DETONATION DETECTED'}
            </motion.div>
            <Panel label="LOCKOUT DURATION" className="w-full max-w-sm text-center">
              <p className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--color-phosphor-dim)' }}>
                Unlocks in
              </p>
              <Countdown until={state.lockedUntil} />
            </Panel>
          </div>
        </TerminalReveal>
      </div>
    )
  }

  if (state.status === 'expired') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="SESSION EXPIRED" color="amber" />} />
        <div className="flex-1 flex items-center justify-center gap-4">
          <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-amber)' }}>
            Session expired.
          </span>
          <GlowButton onClick={load}>[RESTART]</GlowButton>
        </div>
      </div>
    )
  }

  if (state.status === 'unlocked') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="AUTHORIZATION TERMINAL" right={<StatusIndicator label="UNLOCKING" />} />
        <div className="flex-1 flex items-center justify-center">
          <motion.span
            className="text-xl tracking-widest uppercase font-bold"
            style={{
              color: 'var(--color-phosphor)',
              textShadow: '0 0 4px var(--color-phosphor), 0 0 20px var(--color-phosphor)',
            }}
            animate={{ scale: [1, 1.03, 1, 1.03, 1] }}
            transition={{ duration: 0.6 }}
          >
            ALL KEYS VERIFIED — REDIRECTING
          </motion.span>
        </div>
      </div>
    )
  }

  // in_progress state
  const progress = state.matchedCount / state.total

  return (
    <motion.div
      className="flex flex-col h-screen overflow-hidden"
      animate={detonating ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Red flash overlay on detonation */}
      <AnimatePresence>
        {detonating && (
          <motion.div
            className="fixed inset-0 pointer-events-none"
            style={{ background: 'var(--color-alert)', zIndex: 100 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
          />
        )}
      </AnimatePresence>

      {/* Detonation typewriter — visible while still in in_progress state */}
      {detonating && detonationText && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 200 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span
            className="text-3xl font-bold tracking-widest uppercase"
            style={{ color: 'var(--color-alert)', textShadow: '0 0 8px var(--color-alert), 0 0 24px var(--color-alert)' }}
          >
            {detonationText}
          </span>
        </motion.div>
      )}

      <PageHeader
        title="AUTHORIZATION TERMINAL"
        right={
          <div className="flex items-center gap-4">
            {/* sr-only span: E2E checks toContainText('X of Y'), visual span shows mission control format */}
            <span data-testid="progress" className="sr-only">
              {state.matchedCount} of {state.total}
            </span>
            <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-phosphor)' }}>
              [{state.matchedCount}/{state.total} AUTHORIZED]
            </span>
            <div className="hidden sm:block w-32 h-0.5 relative" style={{ background: 'var(--color-panel-border)' }}>
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{ background: 'var(--color-phosphor)', boxShadow: '0 0 6px var(--color-phosphor)' }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        }
      />

      <TerminalReveal>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex-1 grid ${gridClass(state.participants.length)} overflow-auto`}>
            {state.participants.map((p, i) => {
              let status: StationStatus = 'awaiting'
              if (detonating) status = 'detonated'
              else if (p.matched) status = 'authorized'
              const isNext = !p.matched && state.participants.slice(0, i).every((pp) => pp.matched)
              return (
                <div key={p.id} data-testid={`participant-${p.name}`}>
                  <StationPanel name={p.name} index={i} status={status} active={isNext} />
                </div>
              )
            })}
          </div>

          <div
            className="shrink-0 p-4 border-t flex items-center gap-4"
            style={{ borderColor: 'var(--color-panel-border)' }}
          >
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={submit}
              disabled={busy || detonating}
              data-testid="code"
            />
            {/* sr-only button preserves data-testid="enter" for E2E click() compat */}
            <button
              data-testid="enter"
              onClick={() => submit(code)}
              disabled={busy}
              className="sr-only"
            >
              Enter
            </button>
          </div>

          <p
            className="px-4 pb-2 text-xs tracking-widest"
            style={{ color: 'var(--color-phosphor-dim)' }}
          >
            One wrong code locks this for 24 hours. No retries.
          </p>
        </div>
      </TerminalReveal>
    </motion.div>
  )
}
