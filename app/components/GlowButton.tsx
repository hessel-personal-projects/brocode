'use client'

import { useState } from 'react'

type GlowColor = 'phosphor' | 'alert'

const colorVar: Record<GlowColor, string> = {
  phosphor: 'var(--color-phosphor)',
  alert: 'var(--color-alert)',
}

interface GlowButtonProps {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  color?: GlowColor
  className?: string
  'data-testid'?: string
}

export function GlowButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  color = 'phosphor',
  className = '',
  'data-testid': testId,
}: GlowButtonProps) {
  const [flashing, setFlashing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const c = colorVar[color]

  function handleClick() {
    setFlashing(true)
    setTimeout(() => setFlashing(false), 150)
    onClick?.()
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      data-testid={testId}
      className={`px-4 py-2 text-xs tracking-widest uppercase border transition-all duration-150 disabled:opacity-40 cursor-pointer ${className}`}
      style={{
        borderColor: c,
        color: flashing ? 'var(--color-bg)' : c,
        background: flashing ? c : 'transparent',
        textShadow: flashing ? 'none' : `0 0 4px ${c}`,
        boxShadow: flashing
          ? `0 0 16px ${c}`
          : hovered
            ? `0 0 12px ${c}, inset 0 0 4px ${c}`
            : `0 0 4px ${c}`,
      }}
    >
      {children}
    </button>
  )
}
