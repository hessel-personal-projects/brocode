'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type ViewResult = { assetKind: 'image' | 'video'; signedUrl: string }

export default function ViewPage() {
  const { viewToken } = useParams<{ viewToken: string }>()
  const [result, setResult] = useState<ViewResult | null>(null)
  const [gone, setGone] = useState(false)
  // Guard against React StrictMode double-invocation: the view token is single-use,
  // so a second fetch would get 410 and incorrectly show the "Re-locked" screen.
  // We do NOT use an `active` flag here: StrictMode calls the cleanup between the
  // two mounts, which would set active=false and cause the first fetch's result to
  // be discarded (the page would be stuck on "Revealing…").  fetchedRef is the
  // single source of truth — only one fetch ever fires, so stale-state risk is nil.
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetch(`/api/view/${viewToken}`)
      .then(async (res) => {
        if (!res.ok) return setGone(true)
        setResult(await res.json())
      })
      .catch(() => setGone(true))
  }, [viewToken])

  if (gone) {
    return (
      <main className="mx-auto max-w-lg p-6" data-testid="relocked">
        <h1 className="text-2xl font-bold">Re-locked</h1>
        <p>This was a single reveal. Run the ritual again to view it once more.</p>
      </main>
    )
  }

  if (!result) return <main className="p-6">Revealing…</main>

  return (
    <main className="mx-auto max-w-2xl p-6">
      {result.assetKind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img data-testid="asset" src={result.signedUrl} alt="revealed asset" className="w-full" />
      ) : (
        <video data-testid="asset" src={result.signedUrl} controls autoPlay className="w-full" />
      )}
      <p className="mt-4 text-sm text-gray-500">Leaving this page re-locks the asset.</p>
    </main>
  )
}
