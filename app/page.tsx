'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PageHeader } from '@/app/components/PageHeader'
import { Panel } from '@/app/components/Panel'
import { StatusIndicator } from '@/app/components/StatusIndicator'
import { GlowButton } from '@/app/components/GlowButton'
import { HoldButton } from '@/app/components/HoldButton'
import { TerminalReveal } from '@/app/components/TerminalReveal'

type Contact = { name: string; email: string }

function inputStyle(focused: boolean) {
  return {
    borderColor: focused ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
    color: 'var(--color-phosphor)',
    caretColor: 'var(--color-phosphor)',
  }
}

export default function CreatePage() {
  const router = useRouter()
  const [creatorName, setCreatorName] = useState('')
  const [creatorEmail, setCreatorEmail] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([{ name: '', email: '' }])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  function updateContact(i: number, patch: Partial<Contact>) {
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  async function submit() {
    setError(null)
    if (!file) return setError('Choose a file')
    setBusy(true)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('creatorName', creatorName)
      form.set('creatorEmail', creatorEmail)
      if (title) form.set('title', title)
      form.set('contacts', JSON.stringify(contacts))
      const res = await fetch('/api/brocodes', { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed')
      router.push(`/manage/${body.managementToken}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="BROCODE LAUNCH SYSTEM v1.0"
        right={<StatusIndicator label={busy ? 'ARMING…' : 'SYSTEM READY'} color="phosphor" />}
      />
      <TerminalReveal>
        <motion.div
          className="flex-1 flex flex-col overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex-1 grid grid-cols-2 overflow-hidden">
            {/* Left: payload parameters */}
            <Panel label="PAYLOAD PARAMETERS" className="overflow-y-auto">
              <div className="space-y-4">
                <label className="block">
                  <span
                    className="text-xs tracking-widest uppercase block mb-1"
                    style={{ color: 'var(--color-phosphor-dim)' }}
                  >
                    Operative Name
                  </span>
                  <input
                    required
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    data-testid="creator-name"
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                    className="w-full bg-transparent border p-2 text-sm outline-none"
                    style={inputStyle(focused === 'name')}
                  />
                </label>

                <label className="block">
                  <span
                    className="text-xs tracking-widest uppercase block mb-1"
                    style={{ color: 'var(--color-phosphor-dim)' }}
                  >
                    Operative E-Mail
                  </span>
                  <input
                    required
                    type="email"
                    value={creatorEmail}
                    onChange={(e) => setCreatorEmail(e.target.value)}
                    data-testid="creator-email"
                    onFocus={() => setFocused('creator-email')}
                    onBlur={() => setFocused(null)}
                    className="w-full bg-transparent border p-2 text-sm outline-none"
                    style={inputStyle(focused === 'creator-email')}
                  />
                </label>

                <label className="block">
                  <span
                    className="text-xs tracking-widest uppercase block mb-1"
                    style={{ color: 'var(--color-phosphor-dim)' }}
                  >
                    Payload Name (optional)
                  </span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="title"
                    onFocus={() => setFocused('title')}
                    onBlur={() => setFocused(null)}
                    className="w-full bg-transparent border p-2 text-sm outline-none"
                    style={inputStyle(focused === 'title')}
                  />
                </label>

                <fieldset className="space-y-2">
                  <legend
                    className="text-xs tracking-widest uppercase mb-2"
                    style={{ color: 'var(--color-phosphor-dim)' }}
                  >
                    Other Operatives (1–10)
                  </legend>
                  {contacts.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span
                        className="text-xs w-6 shrink-0 tabular-nums"
                        style={{ color: 'var(--color-phosphor-dim)' }}
                      >
                        [{String(i + 1).padStart(2, '0')}]
                      </span>
                      <input
                        placeholder="name"
                        value={c.name}
                        onChange={(e) => updateContact(i, { name: e.target.value })}
                        data-testid={`contact-name-${i}`}
                        onFocus={() => setFocused(`cn${i}`)}
                        onBlur={() => setFocused(null)}
                        className="w-1/2 bg-transparent border p-2 text-sm outline-none"
                        style={inputStyle(focused === `cn${i}`)}
                      />
                      <input
                        placeholder="email"
                        value={c.email}
                        onChange={(e) => updateContact(i, { email: e.target.value })}
                        data-testid={`contact-email-${i}`}
                        onFocus={() => setFocused(`ce${i}`)}
                        onBlur={() => setFocused(null)}
                        className="w-1/2 bg-transparent border p-2 text-sm outline-none"
                        style={inputStyle(focused === `ce${i}`)}
                      />
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setContacts((cs) => cs.filter((_, idx) => idx !== i))}
                          className="text-xs shrink-0"
                          style={{ color: 'var(--color-alert)' }}
                        >
                          [X]
                        </button>
                      )}
                    </div>
                  ))}
                  <GlowButton
                    disabled={contacts.length >= 10}
                    onClick={() => setContacts((cs) => [...cs, { name: '', email: '' }])}
                    data-testid="add-contact"
                  >
                    [+ ADD OPERATIVE]
                  </GlowButton>
                </fieldset>

                {error && (
                  <p
                    className="text-xs tracking-widest"
                    data-testid="error"
                    style={{ color: 'var(--color-alert)' }}
                  >
                    ⚠ {error}
                  </p>
                )}
              </div>
            </Panel>

            {/* Right: payload */}
            <Panel label="PAYLOAD" className="overflow-y-auto">
              <label className="block cursor-pointer">
                <input
                  required
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  data-testid="file"
                  className="sr-only"
                />
                <div
                  className="border-2 border-dashed p-8 text-center flex flex-col items-center gap-3"
                  style={{
                    borderColor: file ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
                    boxShadow: file ? '0 0 8px var(--color-phosphor)' : 'none',
                  }}
                >
                  {file ? (
                    <>
                      <span
                        className="text-xs tracking-widest uppercase"
                        style={{
                          color: 'var(--color-phosphor)',
                          textShadow: '0 0 4px var(--color-phosphor)',
                        }}
                      >
                        ✓ PAYLOAD LOADED
                      </span>
                      <span className="text-xs break-all" style={{ color: 'var(--color-phosphor-dim)' }}>
                        {file.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="text-sm tracking-widest uppercase"
                        style={{ color: 'var(--color-phosphor-dim)' }}
                      >
                        DROP PAYLOAD OR CLICK TO UPLOAD
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-phosphor-dim)' }}>
                        Image or video · max 5 MB
                      </span>
                    </>
                  )}
                </div>
              </label>
            </Panel>
          </div>

          <div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--color-panel-border)' }}>
            <HoldButton onActivate={submit} disabled={busy} data-testid="submit">
              {busy ? 'ARMING BROCODE…' : '▶ ARM BROCODE — HOLD TO CONFIRM'}
            </HoldButton>
          </div>
        </motion.div>
      </TerminalReveal>
    </div>
  )
}
