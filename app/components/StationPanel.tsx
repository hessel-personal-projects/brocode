'use client'

import { motion } from 'framer-motion'

export type StationStatus = 'awaiting' | 'authorized' | 'detonated'

interface StationPanelProps {
  name: string
  index: number
  status: StationStatus
  active?: boolean
}

const cfg = {
  awaiting: {
    label: 'AWAITING',
    border: 'var(--color-panel-border)',
    text: 'var(--color-phosphor-dim)',
    glow: 'none',
  },
  authorized: {
    label: 'AUTHORIZED',
    border: 'var(--color-phosphor)',
    text: 'var(--color-phosphor)',
    glow: '0 0 8px var(--color-phosphor), 0 0 24px var(--color-phosphor)',
  },
  detonated: {
    label: 'DETONATED',
    border: 'var(--color-alert)',
    text: 'var(--color-alert)',
    glow: '0 0 8px var(--color-alert), 0 0 24px var(--color-alert)',
  },
}

export function StationPanel({ name, index, status, active = false }: StationPanelProps) {
  const c = cfg[status]
  const num = String(index + 1).padStart(2, '0')

  return (
    <motion.div
      className="flex flex-col p-4 border h-full"
      style={{ background: 'var(--color-phosphor-faint)' }}
      animate={{
        borderColor: c.border,
        boxShadow:
          c.glow !== 'none'
            ? c.glow
            : active
              ? 'inset 0 0 16px rgba(0,255,65,0.08)'
              : 'none',
      }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="text-xs tracking-widest uppercase mb-2"
        style={{ color: 'var(--color-phosphor-dim)' }}
      >
        Station {num}
      </div>
      <div
        className="font-bold mb-3"
        style={{ color: 'var(--color-phosphor)', textShadow: '0 0 4px var(--color-phosphor)' }}
      >
        {name}
      </div>
      <motion.div
        className="text-xs tracking-widest uppercase font-bold mb-3"
        animate={{ color: c.text }}
        transition={{ duration: 0.15 }}
        style={{ textShadow: c.glow !== 'none' ? `0 0 4px ${c.text}` : 'none' }}
      >
        STATUS: {c.label}
      </motion.div>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="w-4 h-4 border flex items-center justify-center text-xs"
            style={{
              borderColor: status === 'authorized' ? 'var(--color-phosphor)' : 'var(--color-panel-border)',
              color: status === 'authorized' ? 'var(--color-phosphor)' : 'var(--color-phosphor-dim)',
            }}
          >
            {status === 'authorized' ? '■' : '▣'}
          </span>
        ))}
      </div>
    </motion.div>
  )
}
