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
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
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
            'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </>
  )
}
