'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type ViewResult = { assetKind: 'image' | 'video'; signedUrl: string }

export default function ViewPage() {
  const { viewToken } = useParams<{ viewToken: string }>()
  const [result, setResult] = useState<ViewResult | null>(null)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/view/${viewToken}`)
      .then(async (res) => {
        if (!active) return
        if (!res.ok) return setGone(true)
        setResult(await res.json())
      })
      .catch(() => active && setGone(true))
    return () => {
      active = false
    }
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
