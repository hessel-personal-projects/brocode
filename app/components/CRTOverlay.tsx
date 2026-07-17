export function CRTOverlay() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, var(--color-crt-scanline) 2px, var(--color-crt-scanline) 4px)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at center, transparent 60%, var(--color-crt-vignette) 100%)',
        }}
      />
    </>
  )
}
