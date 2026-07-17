'use client'

import { useEffect, useState } from 'react'

export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, new Date(until).getTime() - now)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return (
    <span
      data-testid="countdown"
      className="font-bold tabular-nums tracking-widest"
      style={{
        color: 'var(--color-amber)',
        textShadow: '0 0 4px var(--color-amber), 0 0 12px var(--color-amber)',
      }}
    >
      {h}h {m}m {s}s
    </span>
  )
}
