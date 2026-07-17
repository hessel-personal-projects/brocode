interface PanelProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function Panel({ label, children, className = '' }: PanelProps) {
  return (
    <div
      className={`flex flex-col border ${className}`}
      style={{ borderColor: 'var(--color-panel-border)', background: 'var(--color-phosphor-faint)' }}
    >
      <div
        className="px-3 py-1 text-xs tracking-widest uppercase border-b shrink-0"
        style={{ borderColor: 'var(--color-panel-border)', color: 'var(--color-phosphor-dim)' }}
      >
        {label}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  )
}
