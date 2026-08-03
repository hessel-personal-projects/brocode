'use client'

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
    bg: 'var(--color-phosphor-faint)',
    border: 'var(--color-panel-border)',
    headerText: 'var(--color-phosphor-dim)',
    nameText: 'var(--color-phosphor)',
    statusText: 'var(--color-phosphor-dim)',
    squareFill: 'transparent',
    squareBorder: 'var(--color-panel-border)',
  },
  authorized: {
    label: 'AUTHORIZED',
    bg: 'var(--color-phosphor)',
    border: 'var(--color-phosphor)',
    headerText: 'var(--color-bg)',
    nameText: 'var(--color-bg)',
    statusText: 'var(--color-bg)',
    squareFill: 'var(--color-bg)',
    squareBorder: 'var(--color-bg)',
  },
  detonated: {
    label: 'DETONATED',
    bg: 'var(--color-alert)',
    border: 'var(--color-alert)',
    headerText: 'var(--color-bg)',
    nameText: 'var(--color-bg)',
    statusText: 'var(--color-bg)',
    squareFill: 'var(--color-bg)',
    squareBorder: 'var(--color-bg)',
  },
}

export function StationPanel({ name, index, status, active = false }: StationPanelProps) {
  const c = cfg[status]
  const num = String(index + 1).padStart(2, '0')

  const boxShadow =
    status === 'authorized'
      ? '0 0 0 2px var(--color-phosphor), 0 0 32px var(--color-phosphor)'
      : status === 'detonated'
        ? '0 0 0 2px var(--color-alert), 0 0 32px var(--color-alert)'
        : active
          ? 'inset 0 0 20px rgba(0, 229, 255, 0.1)'
          : 'none'

  return (
    <div
      className="flex flex-col p-4 border h-full"
      style={{
        background: c.bg,
        borderColor: c.border,
        boxShadow,
        transition: 'background 0.06s, border-color 0.06s, box-shadow 0.06s',
      }}
    >
      <div
        className="text-xs tracking-widest uppercase mb-2"
        style={{ color: c.headerText }}
      >
        Station {num}
      </div>
      <div
        className="font-bold mb-auto text-sm"
        style={{ color: c.nameText }}
      >
        {name}
        {active && status === 'awaiting' && (
          <span style={{ animation: 'cursor-blink 1s step-end infinite' }}>_</span>
        )}
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="w-3 h-3 border"
              style={{
                borderColor: c.squareBorder,
                background: c.squareFill,
              }}
            />
          ))}
        </div>
        <span
          className="text-sm font-bold tracking-wider uppercase"
          style={{
            color: c.statusText,
            fontFamily: 'var(--font-display)',
          }}
        >
          {c.label}
        </span>
      </div>
    </div>
  )
}
