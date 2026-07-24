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
import {
  encryptFile,
  generateCode,
  generateSalt,
  hashCode,
  saltToBase64,
  keyToFragment,
} from '@/lib/client/crypto'
import {
  contactCodeSubject,
  renderContactCodeHtml,
  creatorManageSubject,
  renderCreatorManageHtml,
} from '@/lib/email/template'

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
      // 1. Encrypt file client-side
      const { ciphertext, key } = await encryptFile(file)

      // 2. Get signed upload URL from server
      const uploadUrlRes = await fetch('/api/brocodes/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      })
      if (!uploadUrlRes.ok) throw new Error((await uploadUrlRes.json()).error ?? 'upload-url failed')
      const { objectKey, uploadUrl, assetKind } = await uploadUrlRes.json()

      // 3. Upload encrypted file directly to Supabase Storage (bypasses Vercel size limit)
      const storageRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: ciphertext,
        headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
      })
      if (!storageRes.ok) throw new Error('storage upload failed')

      // 4. Generate and hash codes for creator + all contacts
      const allParticipants = [
        { name: creatorName, email: creatorEmail, role: 'creator' as const },
        ...contacts.map((c) => ({ ...c, role: 'contact' as const })),
      ]
      const participantsWithCodes = await Promise.all(
        allParticipants.map(async (p) => {
          const code = generateCode()
          const salt = generateSalt()
          const codeHash = await hashCode(code, salt)
          return { ...p, code, codeHash, codeSalt: saltToBase64(salt) }
        }),
      )

      // 5. POST metadata only to /api/brocodes
      const creator = participantsWithCodes.find((p) => p.role === 'creator')!
      const contactParticipants = participantsWithCodes.filter((p) => p.role === 'contact')

      const res = await fetch('/api/brocodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectKey,
          contentType: file.type,
          assetKind,
          creatorName,
          creatorEmail,
          creatorCodeHash: creator.codeHash,
          creatorCodeSalt: creator.codeSalt,
          title: title || undefined,
          contacts: contactParticipants.map(({ name, email, codeHash, codeSalt }) => ({
            name, email, codeHash, codeSalt,
          })),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed')

      const { managementToken, unlockToken, participants: createdParticipants } = body

      // 4. Construct URLs with key fragment
      const keyFragment = `key=${keyToFragment(key)}`
      const unlockUrl = `${window.location.origin}/unlock/${unlockToken}#${keyFragment}`
      const manageUrl = `${window.location.origin}/manage/${managementToken}#${keyFragment}`

      // 5. Dispatch emails for each participant
      try {
        for (const pw of participantsWithCodes) {
          const created = createdParticipants.find((p: { email: string }) => p.email === pw.email)
          if (!created) continue

          const isCreator = pw.role === 'creator'
          const subject = isCreator
            ? creatorManageSubject({ creatorName: pw.name, title: title || undefined, code: pw.code, managementUrl: manageUrl, unlockUrl, to: pw.email })
            : contactCodeSubject({ contactName: pw.name, title: title || undefined, code: pw.code, unlockUrl, to: pw.email })
          const html = isCreator
            ? renderCreatorManageHtml({ creatorName: pw.name, code: pw.code, managementUrl: manageUrl, unlockUrl, to: pw.email, title: title || undefined })
            : renderContactCodeHtml({ contactName: pw.name, code: pw.code, unlockUrl, to: pw.email, title: title || undefined })

          const dispatchRes = await fetch('/api/dispatch-email', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${managementToken}`,
            },
            body: JSON.stringify({ to: pw.email, subject, html }),
          })
          if (dispatchRes.ok) {
            const { messageId } = await dispatchRes.json()
            await fetch(`/api/brocodes/manage/${managementToken}/participants/${created.id}/message-id`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ messageId }),
            })
          }
        }
      } catch {
        // Ignore email dispatch errors - navigation should still happen
      }

      // 6. Navigate to manage page with key in fragment
      router.push(`/manage/${managementToken}#${keyFragment}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen sm:h-screen sm:overflow-hidden">
      <PageHeader
        title="BROCODE LAUNCH SYSTEM v1.0"
        right={<StatusIndicator label={busy ? 'ARMING…' : 'SYSTEM READY'} color="phosphor" />}
      />
      <TerminalReveal>
        <motion.div
          className="flex-1 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="grid grid-cols-1 sm:flex-1 sm:grid-cols-2 sm:overflow-hidden">
            {/* Left: payload parameters */}
            <Panel label="PAYLOAD PARAMETERS" className="sm:overflow-y-auto">
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
                        className="flex-1 min-w-0 bg-transparent border p-2 text-sm outline-none"
                        style={inputStyle(focused === `cn${i}`)}
                      />
                      <input
                        placeholder="email"
                        value={c.email}
                        onChange={(e) => updateContact(i, { email: e.target.value })}
                        data-testid={`contact-email-${i}`}
                        onFocus={() => setFocused(`ce${i}`)}
                        onBlur={() => setFocused(null)}
                        className="flex-1 min-w-0 bg-transparent border p-2 text-sm outline-none"
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
            <Panel label="PAYLOAD" className="sm:overflow-y-auto">
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
