'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  onComplete: (code: string) => void
  disabled?: boolean
  'data-testid'?: string
}

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  'data-testid': testId,
}: CodeInputProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLInputElement>(null)
  const digits = value.padEnd(6, ' ').slice(0, 6).split('')

  function handleOverlayChange(e: React.ChangeEvent<HTMLInputElement>) {
    const filtered = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange(filtered)
    if (filtered.length === 6) onComplete(filtered)
  }

  return (
    <motion.div
      ref={containerRef}
      className="relative flex items-center gap-3 cursor-text"
      animate={value.length === 6 ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={() => overlayRef.current?.focus()}
    >
      <span
        className="text-xs tracking-widest uppercase shrink-0"
        style={{ color: 'var(--color-phosphor-dim)' }}
      >
        Enter Authorization Code ▶
      </span>

      {/* Visual digit boxes */}
      <div className="flex gap-2 pointer-events-none" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const d = digits[i]
          const filled = d !== ' ' && d !== undefined
          return (
            <motion.span
              key={i}
              className="w-10 h-12 flex items-center justify-center text-xl font-bold border"
              style={{
                borderColor: filled ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
                color: 'var(--color-phosphor)',
                textShadow: filled
                  ? '0 0 4px var(--color-phosphor), 0 0 12px var(--color-phosphor)'
                  : 'none',
              }}
              animate={filled ? { opacity: [0.5, 1], scale: [0.9, 1] } : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
            >
              {filled ? d : ''}
            </motion.span>
          )
        })}
      </div>

      {/*
        Overlay input: not display:none or visibility:hidden so Playwright can fill() it.
        opacity: 0.01 is above 0 — Playwright treats this as visible/actionable.
        Positioned absolute over the digit boxes area to capture real user clicks too.
      */}
      <input
        ref={overlayRef}
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={handleOverlayChange}
        disabled={disabled}
        data-testid={testId}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '260px', // covers the 6 digit boxes
          opacity: 0.01,
          color: 'transparent',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          cursor: 'default',
        }}
      />
    </motion.div>
  )
}
