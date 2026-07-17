'use client'

type StatusColor = 'phosphor' | 'amber' | 'alert'

const colorVar: Record<StatusColor, string> = {
  phosphor: 'var(--color-phosphor)',
  amber: 'var(--color-amber)',
  alert: 'var(--color-alert)',
}

interface StatusIndicatorProps {
  label: string
  color?: StatusColor
}

export function StatusIndicator({ label, color = 'phosphor' }: StatusIndicatorProps) {
  const c = colorVar[color]
  return (
    <span className="flex items-center gap-2 text-xs tracking-widest uppercase">
      <span
        className="inline-block w-2 h-2 rounded-full animate-pulse"
        style={{ background: c, boxShadow: `0 0 6px ${c}` }}
      />
      <span style={{ color: c }}>{label}</span>
    </span>
  )
}
