'use client'

import { useState } from 'react'

type Contact = { name: string; email: string }
type Result = { managementToken: string; unlockToken: string; creatorCode: string }

export default function CreatePage() {
  const [creatorName, setCreatorName] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([{ name: '', email: '' }])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  function updateContact(i: number, patch: Partial<Contact>) {
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file) return setError('Choose a file')
    setBusy(true)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('creatorName', creatorName)
      if (title) form.set('title', title)
      form.set('contacts', JSON.stringify(contacts))
      const res = await fetch('/api/brocodes', { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed')
      setResult(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const manageUrl = `${window.location.origin}/manage/${result.managementToken}`
    return (
      <main className="mx-auto max-w-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold">Brocode armed</h1>
        <div className="rounded border border-red-400 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">This is shown once. Lose it and it&apos;s gone.</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Your management link</p>
          <a data-testid="manage-link" className="break-all text-blue-700 underline" href={manageUrl}>{manageUrl}</a>
        </div>
        <div>
          <p className="text-sm text-gray-600">Your code</p>
          <p data-testid="creator-code" className="text-3xl font-bold tracking-widest">{result.creatorCode}</p>
        </div>
        <p className="text-sm text-gray-600">Contacts have been emailed their codes and the shared unlock link.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-2xl font-bold">Create a Brocode</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm">Your name</span>
          <input required value={creatorName} onChange={(e) => setCreatorName(e.target.value)}
            className="mt-1 w-full rounded border p-2" data-testid="creator-name" />
        </label>

        <label className="block">
          <span className="text-sm">Title (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border p-2" data-testid="title" />
        </label>

        <label className="block">
          <span className="text-sm">Media (≤ 5MB image or video)</span>
          <input required type="file" accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full" data-testid="file" />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm">Contacts (1–10)</legend>
          {contacts.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder="name" value={c.name} onChange={(e) => updateContact(i, { name: e.target.value })}
                className="w-1/2 rounded border p-2" data-testid={`contact-name-${i}`} />
              <input placeholder="email" value={c.email} onChange={(e) => updateContact(i, { email: e.target.value })}
                className="w-1/2 rounded border p-2" data-testid={`contact-email-${i}`} />
            </div>
          ))}
          <button type="button" disabled={contacts.length >= 10}
            onClick={() => setContacts((cs) => [...cs, { name: '', email: '' }])}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50" data-testid="add-contact">
            Add contact
          </button>
        </fieldset>

        {error && <p className="text-red-700" data-testid="error">{error}</p>}

        <button disabled={busy} type="submit"
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" data-testid="submit">
          {busy ? 'Arming…' : 'Arm Brocode'}
        </button>
      </form>
    </main>
  )
}
