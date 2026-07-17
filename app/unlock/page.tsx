'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PageHeader } from '@/app/components/PageHeader'
import { Panel } from '@/app/components/Panel'
import { GlowButton } from '@/app/components/GlowButton'
import { TerminalReveal } from '@/app/components/TerminalReveal'
import { StatusIndicator } from '@/app/components/StatusIndicator'

export default function UnlockLanding() {
  const router = useRouter()
  const [assetId, setAssetId] = useState('')
  const [focused, setFocused] = useState(false)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        title="BROCODE AUTHORIZATION TERMINAL"
        right={<StatusIndicator label="AWAITING INPUT" />}
      />
      <TerminalReveal>
        <div className="flex-1 flex items-center justify-center p-8">
          <Panel label="ENTER MISSION ID" className="w-full max-w-md">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (assetId.trim()) router.push(`/unlock/${assetId.trim()}`)
              }}
              className="space-y-4"
            >
              <div>
                <span
                  className="text-xs tracking-widest uppercase block mb-1"
                  style={{ color: 'var(--color-phosphor-dim)' }}
                >
                  Mission ID from your authorization email
                </span>
                <input
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  data-testid="asset-id"
                  placeholder="paste mission ID"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className="w-full bg-transparent border p-2 text-sm outline-none"
                  style={{
                    borderColor: focused ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
                    color: 'var(--color-phosphor)',
                    caretColor: 'var(--color-phosphor)',
                  }}
                />
              </div>
              <GlowButton type="submit" data-testid="go">
                [PROCEED]
              </GlowButton>
            </form>
          </Panel>
        </div>
      </TerminalReveal>
    </div>
  )
}
