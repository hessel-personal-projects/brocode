'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Countdown } from '@/app/components/Countdown'
import { PageHeader } from '@/app/components/PageHeader'
import { Panel } from '@/app/components/Panel'
import { GlowButton } from '@/app/components/GlowButton'
import { TerminalReveal } from '@/app/components/TerminalReveal'
import { StatusIndicator } from '@/app/components/StatusIndicator'

type EmailDeliveryStatus = 'PENDING' | 'DELIVERED' | 'BOUNCED' | 'FAILED'
type Contact = { id: string; name: string; email: string; emailDeliveryStatus: EmailDeliveryStatus }
type Creator = { id: string; email: string; emailDeliveryStatus: EmailDeliveryStatus }
type ManageData = {
  title: string | null
  locked: boolean
  lockedUntil: string | null
  unlockToken: string
  creator: Creator
  contacts: Contact[]
}

function isTerminal(status: EmailDeliveryStatus): boolean {
  return status === 'DELIVERED' || status === 'BOUNCED' || status === 'FAILED'
}

function DeliveryBadge({ status }: { status: EmailDeliveryStatus }) {
  if (status === 'DELIVERED')
    return (
      <span className="text-xs tracking-widest" style={{ color: 'var(--color-phosphor)' }}>
        ● DELIVERED
      </span>
    )
  if (status === 'PENDING')
    return (
      <span className="text-xs tracking-widest" style={{ color: 'var(--color-phosphor-dim)' }}>
        ○ PENDING
      </span>
    )
  return (
    <span className="text-xs tracking-widest font-bold" style={{ color: 'var(--color-alert)' }}>
      ⚠ DELIVERY FAILED
    </span>
  )
}

export default function ManagePage() {
  const { managementToken } = useParams<{ managementToken: string }>()
  const [data, setData] = useState<ManageData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resentIds, setResentIds] = useState<Set<string>>(new Set())
  const [editEmails, setEditEmails] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const res = await fetch(`/api/brocodes/manage/${managementToken}`)
    if (res.status === 404) return setNotFound(true)
    setData(await res.json())
  }, [managementToken])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const allTerminal =
    data !== null &&
    isTerminal(data.creator.emailDeliveryStatus) &&
    data.contacts.every((c) => isTerminal(c.emailDeliveryStatus))

  useEffect(() => {
    if (allTerminal || deleted) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [allTerminal, deleted, load])

  async function resend(participantId: string) {
    const res = await fetch(`/api/brocodes/manage/${managementToken}/resend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantId }),
    })
    if (res.ok) {
      setResentIds((s) => new Set(s).add(participantId))
      setTimeout(
        () => setResentIds((s) => { const n = new Set(s); n.delete(participantId); return n }),
        1500,
      )
      await load()
    }
    setNotice(res.ok ? 'Email re-sent' : 'Resend failed')
  }

  async function saveEmail(participantId: string) {
    const email = editEmails[participantId]?.trim()
    if (!email) return
    const res = await fetch(
      `/api/brocodes/manage/${managementToken}/participants/${participantId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      },
    )
    if (res.ok) {
      setEditEmails((prev) => { const n = { ...prev }; delete n[participantId]; return n })
      await load()
    }
  }

  async function remove() {
    // Keep window.confirm() — E2E test uses page.on('dialog', d => d.accept())
    if (!confirm('Delete this Brocode and its media permanently?')) return
    const res = await fetch(`/api/brocodes/manage/${managementToken}`, { method: 'DELETE' })
    if (res.ok) setDeleted(true)
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (notFound) {
    return (
      <div className="flex flex-col h-screen overflow-hidden" data-testid="notfound">
        <PageHeader title="MISSION CONTROL" right={<StatusIndicator label="NOT FOUND" color="alert" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-alert)' }}>
            Mission not found.
          </span>
        </div>
      </div>
    )
  }

  if (deleted) {
    return (
      <div className="flex flex-col h-screen overflow-hidden" data-testid="deleted">
        <PageHeader title="MISSION CONTROL" right={<StatusIndicator label="MISSION DELETED" color="alert" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-phosphor-dim)' }}>
            Mission data purged.
          </span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="MISSION CONTROL" right={<StatusIndicator label="LOADING" color="amber" />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase animate-pulse" style={{ color: 'var(--color-phosphor-dim)' }}>
            Loading…
          </span>
        </div>
      </div>
    )
  }

  const unlockUrl = `${window.location.origin}/unlock/${data.unlockToken}`

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title={`MISSION CONTROL${data.title ? ` — ${data.title.toUpperCase()}` : ''}`}
        right={
          <StatusIndicator
            label={data.locked ? 'LOCKOUT ACTIVE' : 'OPERATIONAL'}
            color={data.locked ? 'alert' : 'phosphor'}
          />
        }
      />
      <TerminalReveal>
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Lockout banner */}
          <AnimatePresence>
            {data.locked && data.lockedUntil && (
              <motion.div
                data-testid="locked-notice"
                className="px-6 py-3 flex items-center gap-4 border-b shrink-0"
                style={{ background: 'rgba(255,34,34,0.08)', borderColor: 'var(--color-alert)', color: 'var(--color-alert)' }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <span className="text-xs tracking-widest uppercase font-bold">⚠ LOCKOUT ACTIVE</span>
                <Countdown until={data.lockedUntil} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unlock endpoint — full width */}
          <Panel label="UNLOCK ENDPOINT">
            <div className="space-y-3">
              <p
                className="text-xs break-all leading-relaxed"
                style={{ color: 'var(--color-phosphor-dim)' }}
                data-testid="unlock-url"
              >
                {unlockUrl}
              </p>
              <GlowButton onClick={() => copyLink(unlockUrl)}>
                {copied ? '✓ COPIED' : '[COPY LINK]'}
              </GlowButton>
            </div>
          </Panel>

          {/* Operative roster */}
          <Panel label="OPERATIVE ROSTER" className="flex-1">
            {notice && (
              <p data-testid="notice" className="mb-3 text-xs tracking-widest" style={{ color: 'var(--color-phosphor-dim)' }}>
                {notice}
              </p>
            )}

            {/* Creator email status */}
            <div className="mb-4 pb-4 border-b" style={{ borderColor: 'var(--color-panel-border)' }}>
              <div
                className="text-xs tracking-widest uppercase mb-2"
                style={{ color: 'var(--color-phosphor-dim)' }}
              >
                YOUR AUTHORIZATION EMAIL
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm" style={{ color: 'var(--color-phosphor-dim)' }}>
                  {data.creator.email}
                </span>
                <DeliveryBadge status={data.creator.emailDeliveryStatus} />
              </div>
              {(data.creator.emailDeliveryStatus === 'BOUNCED' ||
                data.creator.emailDeliveryStatus === 'FAILED') && (
                <div className="mt-2 flex gap-2 items-center">
                  <input
                    type="email"
                    data-testid={`edit-email-${data.creator.id}`}
                    value={editEmails[data.creator.id] ?? data.creator.email}
                    onChange={(e) =>
                      setEditEmails((prev) => ({ ...prev, [data.creator.id]: e.target.value }))
                    }
                    className="bg-transparent border p-1 text-sm outline-none"
                    style={{
                      borderColor: 'var(--color-panel-border)',
                      color: 'var(--color-phosphor)',
                      caretColor: 'var(--color-phosphor)',
                    }}
                  />
                  <GlowButton
                    onClick={() => saveEmail(data.creator.id)}
                    data-testid={`save-email-${data.creator.id}`}
                  >
                    [UPDATE & RESEND]
                  </GlowButton>
                </div>
              )}
            </div>

            {/* Mobile operative cards — hidden on sm+ */}
            <div className="sm:hidden">
              {data.contacts.map((c, i) => (
                <div
                  key={c.id}
                  data-testid="mobile-operative-card"
                  className="py-3 border-b"
                  style={{ borderColor: 'var(--color-panel-border)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs tabular-nums shrink-0"
                      style={{ color: 'var(--color-phosphor-dim)' }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-sm" style={{ color: 'var(--color-phosphor)' }}>
                      {c.name}
                    </span>
                    <DeliveryBadge status={c.emailDeliveryStatus} />
                  </div>
                  <div className="mb-2">
                    {c.emailDeliveryStatus === 'BOUNCED' || c.emailDeliveryStatus === 'FAILED' ? (
                      <input
                        type="email"
                        value={editEmails[c.id] ?? c.email}
                        onChange={(e) =>
                          setEditEmails((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        className="w-full bg-transparent border p-1 text-sm outline-none"
                        style={{
                          borderColor: 'var(--color-panel-border)',
                          color: 'var(--color-phosphor)',
                          caretColor: 'var(--color-phosphor)',
                        }}
                      />
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-phosphor-dim)' }}>
                        {c.email}
                      </span>
                    )}
                  </div>
                  <div>
                    {c.emailDeliveryStatus === 'BOUNCED' || c.emailDeliveryStatus === 'FAILED' ? (
                      <GlowButton onClick={() => saveEmail(c.id)}>
                        [UPDATE & RESEND]
                      </GlowButton>
                    ) : (
                      <GlowButton onClick={() => resend(c.id)}>
                        {resentIds.has(c.id) ? '✓ SENT' : '[RESEND AUTHORIZATION]'}
                      </GlowButton>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Contacts table */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr
                  className="text-xs tracking-widest uppercase border-b"
                  style={{ borderColor: 'var(--color-panel-border)', color: 'var(--color-phosphor-dim)' }}
                >
                  <th className="text-left py-2 w-8">#</th>
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.contacts.map((c, i) => (
                  <tr key={c.id} className="border-b" style={{ borderColor: 'var(--color-panel-border)' }}>
                    <td className="py-2 text-xs" style={{ color: 'var(--color-phosphor-dim)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2">{c.name}</td>
                    <td className="py-2 text-xs" style={{ color: 'var(--color-phosphor-dim)' }}>
                      {c.emailDeliveryStatus === 'BOUNCED' || c.emailDeliveryStatus === 'FAILED' ? (
                        <input
                          type="email"
                          data-testid={`edit-email-${c.id}`}
                          value={editEmails[c.id] ?? c.email}
                          onChange={(e) =>
                            setEditEmails((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          className="bg-transparent border p-1 text-sm outline-none w-full"
                          style={{
                            borderColor: 'var(--color-panel-border)',
                            color: 'var(--color-phosphor)',
                            caretColor: 'var(--color-phosphor)',
                          }}
                        />
                      ) : (
                        c.email
                      )}
                    </td>
                    <td className="py-2">
                      <DeliveryBadge status={c.emailDeliveryStatus} />
                    </td>
                    <td className="py-2 text-right">
                      {c.emailDeliveryStatus === 'BOUNCED' || c.emailDeliveryStatus === 'FAILED' ? (
                        <GlowButton
                          onClick={() => saveEmail(c.id)}
                          data-testid={`save-email-${c.id}`}
                        >
                          [UPDATE & RESEND]
                        </GlowButton>
                      ) : (
                        <GlowButton onClick={() => resend(c.id)} data-testid={`resend-${c.id}`}>
                          {resentIds.has(c.id) ? '✓ SENT' : '[RESEND AUTHORIZATION]'}
                        </GlowButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Danger zone */}
          <div
            className="m-4 p-4 border shrink-0"
            style={{ borderColor: 'var(--color-alert)' }}
          >
            <div
              className="text-xs tracking-widest uppercase mb-3 font-bold"
              style={{ color: 'var(--color-alert)', textShadow: '0 0 4px var(--color-alert)' }}
            >
              PERMANENT DELETION
            </div>
            <GlowButton color="alert" onClick={remove} data-testid="delete">
              [DELETE BROCODE]
            </GlowButton>
          </div>
        </div>
      </TerminalReveal>
    </div>
  )
}
