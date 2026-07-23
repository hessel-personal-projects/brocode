'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/app/components/PageHeader'
import { StatusIndicator } from '@/app/components/StatusIndicator'
import { decryptAsset, fragmentToKey } from '@/lib/client/crypto'

type ViewResult = { assetKind: 'image' | 'video'; signedUrl: string }
type Phase = 'scanning' | 'revealed' | 'gone' | 'no-key'

export default function ViewPage() {
  const { viewToken } = useParams<{ viewToken: string }>()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [assetKind, setAssetKind] = useState<'image' | 'video' | null>(null)
  const [phase, setPhase] = useState<Phase>('scanning')
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const hash = window.location.hash
    const keyParam = hash.startsWith('#key=') ? hash.slice('#key='.length) : null
    if (!keyParam) {
      setPhase('no-key')
      return
    }

    let key: Uint8Array
    try {
      key = fragmentToKey(keyParam)
    } catch {
      setPhase('no-key')
      return
    }

    fetch(`/api/view/${viewToken}`)
      .then(async (res) => {
        if (!res.ok) return setPhase('gone')
        const data: ViewResult = await res.json()
        setAssetKind(data.assetKind)

        const encryptedRes = await fetch(data.signedUrl)
        if (!encryptedRes.ok) return setPhase('gone')
        const encryptedBuffer = await encryptedRes.arrayBuffer()

        const plain = await decryptAsset(encryptedBuffer, key)
        const mimeType = data.assetKind === 'image' ? 'image/jpeg' : 'video/mp4'
        const url = URL.createObjectURL(new Blob([plain], { type: mimeType }))
        setBlobUrl(url)
        setTimeout(() => setPhase('revealed'), 900)
      })
      .catch(() => setPhase('gone'))
  }, [viewToken])

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  if (phase === 'no-key') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <PageHeader title="PAYLOAD DECRYPT" right={<StatusIndicator label="KEY MISSING" color="alert" />} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p
            className="text-2xl font-bold tracking-widest uppercase"
            style={{ color: 'var(--color-alert)', textShadow: '0 0 4px var(--color-alert)' }}
          >
            DECRYPTION KEY MISSING
          </p>
          <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-phosphor-dim)' }}>
            This link is missing the decryption key — make sure you copied the full URL.
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'gone') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" data-testid="relocked">
        <PageHeader title="PAYLOAD DECRYPT" right={<StatusIndicator label="ACCESS REVOKED" color="alert" />} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p
            className="text-2xl font-bold tracking-widest uppercase"
            style={{ color: 'var(--color-phosphor)', textShadow: '0 0 4px var(--color-phosphor), 0 0 20px var(--color-phosphor)' }}
          >
            PAYLOAD SECURED — ACCESS REVOKED
          </p>
          <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-phosphor-dim)' }}>
            This payload has already been accessed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="PAYLOAD DECRYPT"
        right={
          <StatusIndicator
            label={phase === 'scanning' ? 'DECRYPTING…' : 'PAYLOAD DECRYPTED'}
            color={phase === 'scanning' ? 'amber' : 'phosphor'}
          />
        }
      />
      <div className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden">
        <AnimatePresence>
          {phase === 'scanning' && (
            <motion.div
              key="scanning"
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                aria-hidden="true"
                className="absolute left-0 right-0 pointer-events-none"
                style={{ height: '2px', background: 'var(--color-phosphor)', boxShadow: '0 0 24px 8px var(--color-phosphor)', zIndex: 10 }}
                initial={{ top: 0 }}
                animate={{ top: '100%' }}
                transition={{ duration: 0.8, ease: 'linear' }}
              />
              <p
                className="text-xl font-bold tracking-widest uppercase"
                style={{ color: 'var(--color-phosphor)', textShadow: '0 0 4px var(--color-phosphor), 0 0 20px var(--color-phosphor)' }}
              >
                DECRYPTING PAYLOAD…
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'revealed' && blobUrl && (
            <motion.div
              className="w-full max-w-3xl"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-xs tracking-widest uppercase mb-3 text-center" style={{ color: 'var(--color-phosphor-dim)' }}>
                PAYLOAD DECRYPTED — SINGLE-USE ACCESS
              </p>
              <motion.div
                className="relative border p-1"
                style={{ borderColor: 'var(--color-phosphor)' }}
                animate={{ boxShadow: ['0 0 16px var(--color-phosphor)', '0 0 4px var(--color-phosphor)'] }}
                transition={{ duration: 1.2, delay: 0.3 }}
              >
                {(['top-0 left-0 border-l-2 border-t-2', 'top-0 right-0 border-r-2 border-t-2', 'bottom-0 left-0 border-l-2 border-b-2', 'bottom-0 right-0 border-r-2 border-b-2'] as const).map((cls, i) => (
                  <span key={i} aria-hidden="true" className={`absolute w-4 h-4 ${cls}`} style={{ borderColor: 'var(--color-phosphor)', boxShadow: '0 0 6px var(--color-phosphor)' }} />
                ))}
                {assetKind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img data-testid="asset" src={blobUrl} alt="revealed asset" className="w-full block" />
                ) : (
                  <video data-testid="asset" src={blobUrl} controls autoPlay className="w-full block" />
                )}
              </motion.div>
              <p className="mt-3 text-xs tracking-widest uppercase text-center" style={{ color: 'var(--color-phosphor-dim)' }}>
                Leaving this page re-locks the asset.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
