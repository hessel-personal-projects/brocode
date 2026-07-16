'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function UnlockLanding() {
  const router = useRouter()
  const [assetId, setAssetId] = useState('')

  return (
    <main className="mx-auto max-w-lg p-6 space-y-4">
      <h1 className="text-2xl font-bold">Open a Brocode</h1>
      <p className="text-sm text-gray-600">Paste the asset ID from your email, or use the link you were sent.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (assetId.trim()) router.push(`/unlock/${assetId.trim()}`)
        }}
        className="flex gap-2"
      >
        <input value={assetId} onChange={(e) => setAssetId(e.target.value)}
          className="w-full rounded border p-2" placeholder="asset ID" data-testid="asset-id" />
        <button className="rounded bg-black px-4 py-2 text-white" data-testid="go">Go</button>
      </form>
    </main>
  )
}
