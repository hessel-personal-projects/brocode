'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/app/components/PageHeader'
import { Panel } from '@/app/components/Panel'
import { GlowButton } from '@/app/components/GlowButton'
import { TerminalReveal } from '@/app/components/TerminalReveal'
import { StatusIndicator } from '@/app/components/StatusIndicator'

function AuthForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(false)
    setLoading(true)

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    setLoading(false)

    if (res.ok) {
      const next = searchParams.get('next')
      router.replace(next?.startsWith('/') ? next : '/')
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <Panel label="Authentication Required">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="clearance"
            className="text-xs tracking-widest uppercase"
            style={{ color: 'var(--color-phosphor-dim)' }}
          >
            Clearance Code
          </label>
          <input
            id="clearance"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false) }}
            autoFocus
            autoComplete="current-password"
            className="bg-transparent border-b py-2 text-sm outline-none w-full"
            style={{
              borderColor: error ? 'var(--color-alert)' : 'var(--color-panel-border)',
              color: 'var(--color-phosphor)',
              caretColor: 'var(--color-phosphor)',
            }}
          />
          {error && (
            <span
              className="text-xs tracking-widest uppercase"
              style={{ color: 'var(--color-alert)' }}
            >
              ⚠ Invalid clearance code
            </span>
          )}
        </div>
        <GlowButton type="submit" disabled={loading || !password}>
          {loading ? 'Verifying…' : '[Authenticate]'}
        </GlowButton>
      </form>
    </Panel>
  )
}

export default function LoginPage() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Brocode Access Control"
        right={<StatusIndicator label="Restricted" color="alert" />}
      />
      <TerminalReveal>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <Suspense fallback={null}>
              <AuthForm />
            </Suspense>
          </div>
        </div>
      </TerminalReveal>
    </div>
  )
}
