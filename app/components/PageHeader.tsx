interface PageHeaderProps {
  title: string
  right?: React.ReactNode
}

export function PageHeader({ title, right }: PageHeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-6 py-3 border-b shrink-0"
      style={{ borderColor: 'var(--color-panel-border)' }}
    >
      <span
        className="text-sm tracking-widest uppercase font-bold truncate min-w-0 flex-1 mr-2"
        style={{
          color: 'var(--color-phosphor)',
          textShadow: '0 0 4px var(--color-phosphor), 0 0 12px var(--color-phosphor)',
        }}
      >
        {title}
      </span>
      {right && <div>{right}</div>}
    </header>
  )
}
