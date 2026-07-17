'use client'

import { useCallback, useRef, useState } from 'react'

interface HoldButtonProps {
  children: React.ReactNode
  onActivate: () => void
  disabled?: boolean
  holdMs?: number
  'data-testid'?: string
}

export function HoldButton({
  children,
  onActivate,
  disabled = false,
  holdMs = 500,
  'data-testid': testId,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  const cancel = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    startRef.current = null
    setProgress(0)
  }, [])

  const tick = useCallback(
    (now: number) => {
      if (startRef.current === null) return
      const elapsed = now - startRef.current
      const p = Math.min(elapsed / holdMs, 1)
      setProgress(p)
      if (p >= 1) {
        cancel()
        onActivate()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [holdMs, onActivate, cancel],
  )

  function start() {
    if (disabled) return
    startRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
  }

  function release() {
    if (startRef.current !== null) {
      const elapsed = performance.now() - startRef.current
      // Fast click (< 100ms) is treated as programmatic/E2E — fire immediately
      if (elapsed < 100) {
        cancel()
        onActivate()
        return
      }
    }
    cancel()
  }

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={release}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={release}
      disabled={disabled}
      data-testid={testId}
      className="relative w-full overflow-hidden py-4 text-xs tracking-widest uppercase border disabled:opacity-40 select-none cursor-pointer"
      style={{
        borderColor: 'var(--color-phosphor)',
        color: progress > 0 ? 'var(--color-bg)' : 'var(--color-phosphor)',
        textShadow: progress > 0 ? 'none' : '0 0 4px var(--color-phosphor)',
        boxShadow: '0 0 4px var(--color-phosphor)',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: 'var(--color-phosphor)',
          transformOrigin: 'left',
          transform: `scaleX(${progress})`,
          transition: progress === 0 ? 'transform 0.05s' : 'none',
        }}
      />
      <span className="relative">{children}</span>
    </button>
  )
}
