export function CodeDisplay({ code }: { code: string }) {
  return (
    <div className="flex gap-2 items-end flex-wrap" data-testid="code-display">
      {code.split('').map((d, i) => (
        <span
          key={i}
          className="text-6xl font-bold tabular-nums leading-none"
          style={{
            color: 'var(--color-phosphor)',
            textShadow:
              '0 0 4px var(--color-phosphor), 0 0 12px var(--color-phosphor)',
          }}
        >
          {d}
        </span>
      ))}
    </div>
  )
}
